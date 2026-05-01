import {
  recurringBudgetFindAllActive,
  syncRecurringBudgets,
} from '@api/recurring-budget-controller/recurring-budget-controller';
import { transactionCreate } from '@api/transaction-controller/transaction-controller';
import { holdingFindAll } from '@api/holding-controller/holding-controller';
import {
  categoryCreateBulk,
  categoryCreate,
  categoryDeactivate,
  categoryFindAllActive,
  categoryUpdate,
  getCategoryFindAllActiveQueryKey,
} from '@api/category-controller/category-controller';
import type {
  BudgetPlanResponseDto,
  CategoryFindAllActiveParams,
  CategoryResponseDto,
  CreateTransactionRequestDto,
  PagedModelHoldingResponseDto,
  WalletResponseDto,
  CreateCategoryBulkRequestDto,
  CreateCategoryRequestDto,
  PagedModelCategoryResponseDto,
  PagedModelRecurringBudgetResponseDto,
  RecurringBudgetResponseDto,
  SyncRecurringBudgetResponseDto,
  UpdateCategoryRequestDto,
} from '@api/model';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import PostAddIcon from '@mui/icons-material/PostAdd';
import SyncOutlinedIcon from '@mui/icons-material/SyncOutlined';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { PageHeading } from '@components/PageHeading';
import { apiErrorMessage } from '@utils/apiErrorMessage';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import {
  FC,
  FormEvent,
  Fragment,
  memo,
  type ReactNode,
  startTransition,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import { CategoryBudgetPlansDialog } from './CategoryBudgetPlansDialog';
import {
  budgetAmountToMonthlyEquivalentMinor,
  CATEGORY_BUDGET_LIST_ROW_GRID_INNER,
  CategoryBudgetPlanUsageLine,
} from './categoryBudgetUsage';
import { holdingToWalletDto } from '@pages/home/holdingAdapter';
import { formatWalletAmount } from '@pages/home/walletDisplay';
import { DEFAULT_FIAT_SCALE, majorToMinorUnitsForScale } from '@utils/moneyMinorUnits';
import {
  asCategoryChildren,
  budgetsByCategoryIdFromFlat,
  categoryKindChipColor,
  categoryKindLabel,
  collectIdsInSubtree,
  collectIdsWithChildren,
  findNodeById,
  rootAncestorCategory,
  toCategoryTree,
} from './categoryTreeUtils';
import {
  canonicalAmountFromUserInput,
  defaultDatetimeLocal,
  formatAmountDisplayCs,
  parseAmount,
  toIsoFromDatetimeLocal,
} from '@pages/home/transactionFormUtils';
import { CreateCategoryRequestDtoCategoryKind, CreateTransactionRequestDtoTransactionType } from '@api/model';

const LIST_BASE: Pick<CategoryFindAllActiveParams, 'page' | 'size'> = { page: 0, size: 200 };
const BUDGET_LIST_PARAMS = { page: 0, size: 500 } as const;
const BULK_MAX_LEVEL = 5;

type CreateMode = { type: 'root' } | { type: 'child'; parentId: string };

type EditMode = { category: CategoryResponseDto };

type BulkDraftNode = {
  name: string;
  level: number;
  children: BulkDraftNode[];
};

type BulkPreviewRow = {
  name: string;
  level: number;
};

type WalletOption = WalletResponseDto & {
  assetScale?: number;
};

function parseBulkCategoryText(
  text: string,
  kind: 'INCOME' | 'EXPENSE',
  rootSortStart = 0,
): { items: CreateCategoryBulkRequestDto[]; error?: string } {
  const lines = text
    .split(/\r?\n/)
    .map((raw) => raw.replace(/\s+$/g, ''))
    .filter((raw) => raw.trim().length > 0);
  if (lines.length === 0) return { items: [], error: 'Zadej aspoň jednu kategorii.' };

  const roots: BulkDraftNode[] = [];
  const stack: BulkDraftNode[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const lineNo = i + 1;
    const raw = lines[i];
    const ws = raw.match(/^[\t ]*/)?.[0] ?? '';
    if (ws.includes(' ') && ws.includes('\t')) {
      return { items: [], error: `Řádek ${lineNo}: nepoužívej taby a mezery zároveň.` };
    }

    const level = ws.includes('\t') ? ws.length : Math.floor(ws.length / 2);
    if (!ws.includes('\t') && ws.length % 2 !== 0) {
      return { items: [], error: `Řádek ${lineNo}: pro odsazení použij násobky 2 mezer.` };
    }
    if (level > BULK_MAX_LEVEL) {
      return { items: [], error: `Řádek ${lineNo}: max hloubka je ${BULK_MAX_LEVEL}.` };
    }

    const name = raw.trim().replace(/^[-*•]\s*/, '');
    if (!name) return { items: [], error: `Řádek ${lineNo}: chybí název kategorie.` };

    const node: BulkDraftNode = { name, level, children: [] };
    if (level === 0) {
      roots.push(node);
      stack.length = 0;
      stack.push(node);
      continue;
    }

    const parentLevel = level - 1;
    while (stack.length > 0 && stack[stack.length - 1].level >= level) stack.pop();
    const parent = stack[stack.length - 1];
    if (!parent || parent.level !== parentLevel) {
      return {
        items: [],
        error: `Řádek ${lineNo}: chybí nadřazená kategorie pro hloubku ${level}.`,
      };
    }
    parent.children.push(node);
    stack.push(node);
  }

  const toDto = (
    nodes: BulkDraftNode[],
    kind: 'INCOME' | 'EXPENSE',
    sortStart = 0,
  ): CreateCategoryBulkRequestDto[] =>
    nodes.map((n, idx) => ({
      name: n.name,
      categoryKind: kind,
      sortOrder: sortStart + idx,
      ...(n.children.length > 0 ? { children: toDto(n.children, kind, 0) } : {}),
    }));

  return { items: toDto(roots, kind, rootSortStart) };
}

function parseBulkPreviewText(text: string): { rows: BulkPreviewRow[]; error?: string } {
  const lines = text
    .split(/\r?\n/)
    .map((raw) => raw.replace(/\s+$/g, ''))
    .filter((raw) => raw.trim().length > 0);
  if (lines.length === 0) return { rows: [] };

  const rows: BulkPreviewRow[] = [];
  const stackLevels: number[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const lineNo = i + 1;
    const raw = lines[i];
    const ws = raw.match(/^[\t ]*/)?.[0] ?? '';
    if (ws.includes(' ') && ws.includes('\t')) {
      return { rows, error: `Řádek ${lineNo}: nepoužívej taby a mezery zároveň.` };
    }
    const level = ws.includes('\t') ? ws.length : Math.floor(ws.length / 2);
    if (!ws.includes('\t') && ws.length % 2 !== 0) {
      return { rows, error: `Řádek ${lineNo}: pro odsazení použij násobky 2 mezer.` };
    }
    if (level > BULK_MAX_LEVEL) {
      return { rows, error: `Řádek ${lineNo}: max hloubka je ${BULK_MAX_LEVEL}.` };
    }

    const name = raw.trim().replace(/^[-*•]\s*/, '');
    if (!name) {
      return { rows, error: `Řádek ${lineNo}: chybí název kategorie.` };
    }

    while (stackLevels.length > 0 && stackLevels[stackLevels.length - 1] >= level) stackLevels.pop();
    if (level > 0 && (stackLevels.length === 0 || stackLevels[stackLevels.length - 1] !== level - 1)) {
      return { rows, error: `Řádek ${lineNo}: chybí nadřazená úroveň.` };
    }

    rows.push({ name, level });
    stackLevels.push(level);
  }

  return { rows };
}

export type CategoriesForTrackerProps = {
  trackerId: string;
  trackerName: string;
  /** Volitelné pozice z rodiče (např. dashboard na Domě) pro vynechání extra `holdingFindAll`. */
  walletsFromParent?: WalletOption[];
  /** V záložce na Domě — bez vlastního hlavního nadpisu „Kategorie“. */
  embedded?: boolean;
  /** Když false, dotaz na kategorie neběží (řetězení po peněženkách na Domě). */
  categoriesQueryEnabled?: boolean;
  /** ISO rozmezí pro `categoryFindAllActive` (rozpočty aktivní v období) — stejné jako u peněženek nahoře. */
  categoryActivePeriodIso?: { from: string; to: string } | null;
};

function categoriesForTrackerPropsEqual(
  a: CategoriesForTrackerProps,
  b: CategoriesForTrackerProps,
): boolean {
  return (
    a.trackerId === b.trackerId &&
    a.trackerName === b.trackerName &&
    a.embedded === b.embedded &&
    a.categoriesQueryEnabled === b.categoriesQueryEnabled &&
    a.walletsFromParent === b.walletsFromParent &&
    (a.categoryActivePeriodIso?.from ?? '') === (b.categoryActivePeriodIso?.from ?? '') &&
    (a.categoryActivePeriodIso?.to ?? '') === (b.categoryActivePeriodIso?.to ?? '')
  );
}

const CategoriesForTrackerInner: FC<CategoriesForTrackerProps> = ({
  trackerId,
  trackerName,
  walletsFromParent,
  embedded,
  categoriesQueryEnabled = true,
  categoryActivePeriodIso = null,
}) => {
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();
  const [budgetCategory, setBudgetCategory] = useState<CategoryResponseDto | null>(null);
  const [showOnlyCategoriesWithMovements, setShowOnlyCategoriesWithMovements] = useState(false);

  const categoryListParams = useMemo((): CategoryFindAllActiveParams => {
    const base: CategoryFindAllActiveParams = { ...LIST_BASE };
    if (categoryActivePeriodIso) {
      base.dateFrom = categoryActivePeriodIso.from;
      base.dateTo = categoryActivePeriodIso.to;
    }
    return base;
  }, [categoryActivePeriodIso]);

  const { data, isLoading, isError } = useQuery({
    queryKey: getCategoryFindAllActiveQueryKey(trackerId, categoryListParams),
    queryFn: () => categoryFindAllActive(trackerId, categoryListParams),
    enabled: Boolean(trackerId) && categoriesQueryEnabled,
  });

  const { data: recurringBudgetData } = useQuery({
    queryKey: [`/api/recurring-budget/${trackerId}/active`, BUDGET_LIST_PARAMS],
    queryFn: async () => {
      const res = await recurringBudgetFindAllActive(trackerId, BUDGET_LIST_PARAMS);
      if (res.status < 200 || res.status >= 300) throw new Error('recurring-budget');
      return res.data as PagedModelRecurringBudgetResponseDto;
    },
    enabled: Boolean(trackerId) && categoriesQueryEnabled && Boolean(budgetCategory?.id),
    staleTime: 30_000,
  });

  const { data: walletsData } = useQuery({
    queryKey: ['/api/holding', trackerId, BUDGET_LIST_PARAMS],
    queryFn: async () => {
      const res = await holdingFindAll(trackerId, BUDGET_LIST_PARAMS);
      if (res.status < 200 || res.status >= 300) throw new Error('holdings');
      return res.data as PagedModelHoldingResponseDto;
    },
    enabled: Boolean(trackerId) && categoriesQueryEnabled && walletsFromParent === undefined,
    staleTime: 30_000,
  });

  const paged = data?.data as PagedModelCategoryResponseDto | undefined;
  const flat = paged?.content ?? [];
  const tree = useMemo(() => toCategoryTree(flat), [flat]);
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<Set<string>>(() => new Set());

  const budgetsByCategoryId = useMemo(() => budgetsByCategoryIdFromFlat(flat), [flat]);

  const getBudgetCount = useCallback(
    (categoryId: string) => budgetsByCategoryId.get(categoryId)?.length ?? 0,
    [budgetsByCategoryId],
  );
  const getOneOffBudgets = useCallback(
    (categoryId: string) => budgetsByCategoryId.get(categoryId) ?? [],
    [budgetsByCategoryId],
  );

  const hasMovementInCategory = useCallback(
    (categoryId?: string): boolean => {
      if (!categoryId) return false;
      const plans = budgetsByCategoryId.get(categoryId) ?? [];
      return plans.some((p) => (p.amount ?? 0) > 0 && (p.alreadySpent ?? 0) > 0);
    },
    [budgetsByCategoryId],
  );

  const filteredTree = useMemo(() => {
    if (!showOnlyCategoriesWithMovements) return tree;
    const filterNodes = (nodes: CategoryResponseDto[]): CategoryResponseDto[] => {
      const out: CategoryResponseDto[] = [];
      for (const node of nodes) {
        const children = filterNodes(asCategoryChildren(node.children));
        const selfHasMovement = hasMovementInCategory(node.id);
        if (selfHasMovement || children.length > 0) {
          out.push({ ...node, children });
        }
      }
      return out;
    };
    return filterNodes(tree);
  }, [showOnlyCategoriesWithMovements, tree, hasMovementInCategory]);

  const categoryIdsWithChildren = useMemo(() => collectIdsWithChildren(filteredTree), [filteredTree]);

  const allCategoriesExpanded = useMemo(
    () =>
      categoryIdsWithChildren.length > 0 &&
      categoryIdsWithChildren.every((id) => expandedCategoryIds.has(id)),
    [categoryIdsWithChildren, expandedCategoryIds],
  );

  const toggleCategoryExpand = useCallback((categoryId: string) => {
    setExpandedCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  }, []);

  const toggleExpandAllCategories = useCallback(() => {
    if (categoryIdsWithChildren.length === 0) return;
    startTransition(() => {
      if (allCategoriesExpanded) {
        setExpandedCategoryIds(new Set());
      } else {
        setExpandedCategoryIds(new Set(categoryIdsWithChildren));
      }
    });
  }, [categoryIdsWithChildren, allCategoriesExpanded]);

  const recurringBudgets = (recurringBudgetData?.content ?? []) as RecurringBudgetResponseDto[];
  const recurringByCategoryId = useMemo(() => {
    const m = new Map<string, RecurringBudgetResponseDto[]>();
    for (const r of recurringBudgets) {
      const cid = r.categoryId;
      if (!cid) continue;
      const arr = m.get(cid) ?? [];
      arr.push(r);
      m.set(cid, arr);
    }
    return m;
  }, [recurringBudgets]);

  const rootExpenseCategoryIds = useMemo(() => {
    // "top level" = kořeny stromu (hloubka 0).
    // Požadavek: do součtu se počítají jen EXPENSE rodiče, děti ne.
    return flat
      .filter((n) => Boolean(n.id) && n.categoryKind === 'EXPENSE' && !n.parentId)
      .map((n) => n.id as string);
  }, [flat]);

  const rootIncomeCategoryIds = useMemo(() => {
    return flat
      .filter((n) => Boolean(n.id) && n.categoryKind === 'INCOME' && !n.parentId)
      .map((n) => n.id as string);
  }, [flat]);

  const toMonthlyMinor = useCallback(
    (amountMinor: number, periodType: string | undefined, intervalValue?: number): number =>
      budgetAmountToMonthlyEquivalentMinor(amountMinor, periodType, intervalValue ?? 1),
    [],
  );

  const predictedMonthlyExpenseBuckets = useMemo(() => {
    const sums = new Map<string, number>();
    const add = (currency: string | undefined, amountMinor: number) => {
      const cur = (currency ?? 'CZK').toUpperCase();
      sums.set(cur, (sums.get(cur) ?? 0) + amountMinor);
    };

    for (const categoryId of rootExpenseCategoryIds) {
      for (const p of budgetsByCategoryId.get(categoryId) ?? []) {
        add(p.currencyCode, toMonthlyMinor(p.amount ?? 0, p.periodType, 1));
      }
    }
    return sums;
  }, [rootExpenseCategoryIds, budgetsByCategoryId, toMonthlyMinor]);

  const formatCurrencyBuckets = useCallback((buckets: Map<string, number>): string => {
    if (buckets.size === 0) return '—';
    const entries = Array.from(buckets.entries());
    if (entries.length === 1) {
      const [currency, sum] = entries[0];
      return formatWalletAmount(sum, currency);
    }
    return entries.map(([currency, sum]) => formatWalletAmount(sum, currency)).join(', ');
  }, []);

  const diffBuckets = useCallback((income: Map<string, number>, expense: Map<string, number>): Map<string, number> => {
    const out = new Map<string, number>();
    const keys = new Set([...income.keys(), ...expense.keys()]);
    for (const k of keys) {
      out.set(k, (income.get(k) ?? 0) - (expense.get(k) ?? 0));
    }
    return out;
  }, []);

  const scaleBuckets = useCallback((buckets: Map<string, number>, factor: number): Map<string, number> => {
    return new Map([...buckets.entries()].map(([c, v]) => [c, Math.round(v * factor)]));
  }, []);

  const predictedMonthlyExpenseText = useMemo(() => {
    return formatCurrencyBuckets(predictedMonthlyExpenseBuckets);
  }, [predictedMonthlyExpenseBuckets, formatCurrencyBuckets]);

  const predictedMonthlyIncomeBuckets = useMemo(() => {
    const sums = new Map<string, number>();
    const add = (currency: string | undefined, amountMinor: number) => {
      const cur = (currency ?? 'CZK').toUpperCase();
      sums.set(cur, (sums.get(cur) ?? 0) + amountMinor);
    };

    for (const categoryId of rootIncomeCategoryIds) {
      for (const p of budgetsByCategoryId.get(categoryId) ?? []) {
        add(p.currencyCode, toMonthlyMinor(p.amount ?? 0, p.periodType, 1));
      }
    }

    return sums;
  }, [rootIncomeCategoryIds, budgetsByCategoryId, toMonthlyMinor]);

  const predictedMonthlyIncomeText = useMemo(() => {
    return formatCurrencyBuckets(predictedMonthlyIncomeBuckets);
  }, [predictedMonthlyIncomeBuckets, formatCurrencyBuckets]);

  const actualMonthlyExpenseBuckets = useMemo(() => {
    const sums = new Map<string, number>();
    const add = (currency: string | undefined, amountMinor: number) => {
      const cur = (currency ?? 'CZK').toUpperCase();
      sums.set(cur, (sums.get(cur) ?? 0) + amountMinor);
    };
    for (const categoryId of rootExpenseCategoryIds) {
      for (const p of budgetsByCategoryId.get(categoryId) ?? []) {
        add(p.currencyCode, p.alreadySpent ?? 0);
      }
    }
    return sums;
  }, [rootExpenseCategoryIds, budgetsByCategoryId]);

  const actualMonthlyIncomeBuckets = useMemo(() => {
    const sums = new Map<string, number>();
    const add = (currency: string | undefined, amountMinor: number) => {
      const cur = (currency ?? 'CZK').toUpperCase();
      sums.set(cur, (sums.get(cur) ?? 0) + amountMinor);
    };
    for (const categoryId of rootIncomeCategoryIds) {
      for (const p of budgetsByCategoryId.get(categoryId) ?? []) {
        add(p.currencyCode, p.alreadySpent ?? 0);
      }
    }
    return sums;
  }, [rootIncomeCategoryIds, budgetsByCategoryId]);

  const actualMonthlyExpenseText = useMemo(() => {
    return formatCurrencyBuckets(actualMonthlyExpenseBuckets);
  }, [actualMonthlyExpenseBuckets, formatCurrencyBuckets]);

  const actualMonthlyIncomeText = useMemo(() => {
    return formatCurrencyBuckets(actualMonthlyIncomeBuckets);
  }, [actualMonthlyIncomeBuckets, formatCurrencyBuckets]);

  const predictedMonthlySavingsBuckets = useMemo(
    () => diffBuckets(predictedMonthlyIncomeBuckets, predictedMonthlyExpenseBuckets),
    [diffBuckets, predictedMonthlyIncomeBuckets, predictedMonthlyExpenseBuckets],
  );

  const actualMonthlySavingsBuckets = useMemo(
    () => diffBuckets(actualMonthlyIncomeBuckets, actualMonthlyExpenseBuckets),
    [actualMonthlyIncomeBuckets, actualMonthlyExpenseBuckets, diffBuckets],
  );

  const predictedSavingsYearlyText = useMemo(
    () => formatCurrencyBuckets(scaleBuckets(predictedMonthlySavingsBuckets, 12)),
    [formatCurrencyBuckets, predictedMonthlySavingsBuckets, scaleBuckets],
  );

  const actualSavingsYearlyText = useMemo(
    () => formatCurrencyBuckets(scaleBuckets(actualMonthlySavingsBuckets, 12)),
    [actualMonthlySavingsBuckets, formatCurrencyBuckets, scaleBuckets],
  );

  const renderColoredSavingsAmounts = useCallback((buckets: Map<string, number>): ReactNode => {
    const entries = [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b));
    if (entries.length === 0) return '—';
    return entries.map(([cur, val], i) => (
      <Fragment key={cur}>
        {i > 0 ? ', ' : null}
        <Box
          component="span"
          sx={{
            color: val > 0 ? 'success.main' : val < 0 ? 'error.main' : 'text.secondary',
            fontWeight: 600,
          }}
        >
          {formatWalletAmount(val, cur)}
        </Box>
      </Fragment>
    ));
  }, []);

  const [createOpen, setCreateOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkKind, setBulkKind] = useState<CreateCategoryRequestDtoCategoryKind>(
    CreateCategoryRequestDtoCategoryKind.EXPENSE,
  );
  const [createMode, setCreateMode] = useState<CreateMode>({ type: 'root' });
  const [editState, setEditState] = useState<EditMode | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteCascade, setDeleteCascade] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [quickTxCategory, setQuickTxCategory] = useState<CategoryResponseDto | null>(null);
  const [quickTxWalletId, setQuickTxWalletId] = useState('');
  const [quickTxAmountCanon, setQuickTxAmountCanon] = useState('');
  const [quickTxWhen, setQuickTxWhen] = useState(defaultDatetimeLocal());
  const [quickTxDescription, setQuickTxDescription] = useState('');

  const [formName, setFormName] = useState('');
  const [formKind, setFormKind] = useState<CreateCategoryRequestDtoCategoryKind>(
    CreateCategoryRequestDtoCategoryKind.EXPENSE,
  );
  const [formParentId, setFormParentId] = useState<string>('');
  const createNameInputRef = useRef<HTMLInputElement | null>(null);
  const bulkPreview = useMemo(() => parseBulkPreviewText(bulkText), [bulkText]);
  const [syncRecurringBudgetsSubmitting, setSyncRecurringBudgetsSubmitting] = useState(false);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: [`/api/category/${trackerId}/active`],
    });
  }, [queryClient, trackerId]);

  const invalidateBudgets = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [`/api/category/${trackerId}/active`] });
    queryClient.invalidateQueries({ queryKey: [`/api/recurring-budget/${trackerId}/active`] });
  }, [queryClient, trackerId]);

  const handleSyncRecurringBudgets = useCallback(async () => {
    if (!trackerId) return;
    setSyncRecurringBudgetsSubmitting(true);
    try {
      const res = await syncRecurringBudgets(trackerId);
      if (res.status < 200 || res.status >= 300) {
        enqueueSnackbar(apiErrorMessage(res.data, 'Synchronizace rozpočtů z šablon se nezdařila'), {
          variant: 'error',
        });
        return;
      }
      const body = res.data as unknown as SyncRecurringBudgetResponseDto | undefined;
      const tpl = body?.templatesProcessed;
      const created = body?.budgetPlansCreated;
      const parts: string[] = [];
      if (tpl != null) parts.push(`šablon: ${tpl}`);
      if (created != null) parts.push(`plánů: ${created}`);
      enqueueSnackbar(
        parts.length > 0
          ? `Rozpočty z šablon synchronizovány (${parts.join(', ')})`
          : 'Rozpočty z šablon synchronizovány',
        { variant: 'success' },
      );
      await invalidateBudgets();
    } catch {
      enqueueSnackbar('Synchronizace rozpočtů z šablon se nezdařila', { variant: 'error' });
    } finally {
      setSyncRecurringBudgetsSubmitting(false);
    }
  }, [trackerId, enqueueSnackbar, invalidateBudgets]);

  const activeWallets = useMemo(() => {
    if (walletsFromParent) {
      return walletsFromParent.filter((w) => w.active !== false && w.id);
    }
    const holdings = walletsData?.content ?? [];
    return holdings
      .map((h): WalletOption => ({ ...holdingToWalletDto(h), assetScale: h.assetScale }))
      .filter((w) => w.active !== false && w.id);
  }, [walletsFromParent, walletsData]);

  const quickTxWallet = useMemo(
    () => activeWallets.find((w) => w.id === quickTxWalletId),
    [activeWallets, quickTxWalletId],
  );

  const openCreateRoot = useCallback(() => {
    setCreateMode({ type: 'root' });
    setFormName('');
    setFormKind(CreateCategoryRequestDtoCategoryKind.EXPENSE);
    setFormParentId('');
    setCreateOpen(true);
  }, []);

  const openBulkCreate = useCallback(() => {
    setBulkKind(CreateCategoryRequestDtoCategoryKind.EXPENSE);
    setBulkText('');
    setBulkOpen(true);
  }, []);

  const openCreateChild = useCallback(
    (parentId: string) => {
      const root = rootAncestorCategory(tree, flat, parentId);
      const parentKind =
        (root?.categoryKind as CreateCategoryRequestDtoCategoryKind | undefined) ??
        CreateCategoryRequestDtoCategoryKind.EXPENSE;
      setCreateMode({ type: 'child', parentId });
      setFormName('');
      setFormKind(parentKind);
      setFormParentId(parentId);
      setCreateOpen(true);
    },
    [tree, flat],
  );

  const openEdit = useCallback((category: CategoryResponseDto) => {
    setEditState({ category });
    setFormName(category.name ?? '');
    setFormKind(
      (category.categoryKind as CreateCategoryRequestDtoCategoryKind) ??
        CreateCategoryRequestDtoCategoryKind.EXPENSE,
    );
    setFormParentId(category.parentId ?? '');
    setCreateOpen(false);
  }, []);

  const parentOptionsForEdit = useMemo(() => {
    if (!editState?.category?.id) return [] as { id: string; label: string }[];
    const node = findNodeById(tree, editState.category.id!);
    const exclude = node ? collectIdsInSubtree(node) : new Set<string>();
    const walk = (nodes: CategoryResponseDto[], depth: number): { id: string; label: string }[] => {
      const out: { id: string; label: string }[] = [];
      nodes.forEach((n) => {
        if (!n.id || exclude.has(n.id)) return;
        const pad = `${'\u00A0\u00A0'.repeat(depth)}`;
        out.push({ id: n.id, label: `${pad}${n.name ?? '—'}`.trim() });
        out.push(...walk(asCategoryChildren(n.children), depth + 1));
      });
      return out;
    };
    return walk(tree, 0);
  }, [editState?.category?.id, tree]);

  const parentOptionsForCreate = useMemo(() => {
    const walk = (nodes: CategoryResponseDto[], depth: number): { id: string; label: string }[] => {
      const out: { id: string; label: string }[] = [];
      nodes.forEach((n) => {
        if (!n.id) return;
        const pad = `${'\u00A0\u00A0'.repeat(depth)}`;
        out.push({ id: n.id, label: `${pad}${n.name ?? '—'}`.trim() });
        out.push(...walk(asCategoryChildren(n.children), depth + 1));
      });
      return out;
    };
    return walk(tree, 0);
  }, [tree]);

  const nextSortOrderForParent = useCallback(
    (parentId?: string): number => {
      const parentKey = parentId ?? '';
      let maxSort = -1;
      for (const c of flat) {
        const cParent = c.parentId ?? '';
        if (cParent !== parentKey) continue;
        const s = c.sortOrder ?? -1;
        if (s > maxSort) maxSort = s;
      }
      return maxSort + 1;
    },
    [flat],
  );

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    const name = formName.trim();
    if (!name) {
      enqueueSnackbar('Vyplň název', { variant: 'warning' });
      return;
    }
    const payload: CreateCategoryRequestDto = {
      name,
      categoryKind: formKind,
    };
    if (createMode.type === 'child') {
      payload.parentId = createMode.parentId;
    } else if (formParentId) {
      payload.parentId = formParentId;
    }
    payload.sortOrder = nextSortOrderForParent(payload.parentId);

    setSubmitting(true);
    try {
      const res = await categoryCreate(trackerId, payload);
      if (res.status < 200 || res.status >= 300) {
        const err = res.data as { message?: string; businessErrorDescription?: string } | undefined;
        enqueueSnackbar(
          err?.message ?? err?.businessErrorDescription ?? 'Kategorii se nepodařilo vytvořit',
          { variant: 'error' },
        );
        return;
      }
      enqueueSnackbar('Kategorie byla vytvořena', { variant: 'success' });
      setCreateOpen(false);
      await invalidate();
    } catch {
      enqueueSnackbar('Kategorii se nepodařilo vytvořit', { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkCreate = async (e: FormEvent) => {
    e.preventDefault();
    const kind = bulkKind === CreateCategoryRequestDtoCategoryKind.INCOME ? 'INCOME' : 'EXPENSE';
    const parsed = parseBulkCategoryText(bulkText, kind, nextSortOrderForParent(undefined));
    if (parsed.error) {
      enqueueSnackbar(parsed.error, { variant: 'warning' });
      return;
    }
    if (parsed.items.length === 0) {
      enqueueSnackbar('Zadej aspoň jednu kategorii.', { variant: 'warning' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await categoryCreateBulk(trackerId, parsed.items);
      if (res.status < 200 || res.status >= 300) {
        const err = res.data as { message?: string; businessErrorDescription?: string } | undefined;
        enqueueSnackbar(
          err?.message ?? err?.businessErrorDescription ?? 'Hromadné vytvoření kategorií se nepodařilo',
          { variant: 'error' },
        );
        return;
      }
      enqueueSnackbar('Kategorie byly vytvořeny', { variant: 'success' });
      setBulkOpen(false);
      setBulkText('');
      await invalidate();
    } catch {
      enqueueSnackbar('Hromadné vytvoření kategorií se nepodařilo', { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSwapSiblingOrder = useCallback(
    async (
      categoryId: string,
      siblingId: string,
      categorySortOrder: number,
      siblingSortOrder: number,
    ) => {
      setSubmitting(true);
      try {
        const [resA, resB] = await Promise.all([
          categoryUpdate(trackerId, categoryId, { sortOrder: siblingSortOrder }),
          categoryUpdate(trackerId, siblingId, { sortOrder: categorySortOrder }),
        ]);

        if (resA.status < 200 || resA.status >= 300 || resB.status < 200 || resB.status >= 300) {
          enqueueSnackbar('Změna pořadí se nepodařila', { variant: 'error' });
          return;
        }
        await invalidate();
      } catch {
        enqueueSnackbar('Změna pořadí se nepodařila', { variant: 'error' });
      } finally {
        setSubmitting(false);
      }
    },
    [trackerId, enqueueSnackbar, invalidate],
  );

  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!editState?.category?.id) return;
    const name = formName.trim();
    if (!name) {
      enqueueSnackbar('Vyplň název', { variant: 'warning' });
      return;
    }
    const body: UpdateCategoryRequestDto = {
      name,
      categoryKind: formKind,
      parentId: formParentId || undefined,
    };
    setSubmitting(true);
    try {
      const res = await categoryUpdate(trackerId, editState.category.id, body);
      if (res.status < 200 || res.status >= 300) {
        const err = res.data as { message?: string; businessErrorDescription?: string } | undefined;
        enqueueSnackbar(
          err?.message ?? err?.businessErrorDescription ?? 'Úprava se nepodařila',
          { variant: 'error' },
        );
        return;
      }
      enqueueSnackbar('Kategorie byla upravena', { variant: 'success' });
      setEditState(null);
      await invalidate();
    } catch {
      enqueueSnackbar('Úprava se nepodařila', { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setSubmitting(true);
    try {
      const res = await categoryDeactivate(trackerId, deleteId, { cascade: deleteCascade });
      if (res.status < 200 || res.status >= 300) {
        enqueueSnackbar(apiErrorMessage(res.data, 'Odstranění se nepodařilo'), { variant: 'error' });
        return;
      }
      enqueueSnackbar('Kategorie byla odstraněna', { variant: 'success' });
      setDeleteId(null);
      setDeleteCascade(false);
      await invalidate();
      await invalidateBudgets();
    } catch {
      enqueueSnackbar('Odstranění se nepodařilo (síť nebo neočekávaná chyba)', { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickTxOpen = useCallback((category: CategoryResponseDto) => {
    setQuickTxCategory(category);
    setQuickTxWalletId('');
    setQuickTxAmountCanon('');
    setQuickTxWhen(defaultDatetimeLocal());
    setQuickTxDescription('');
  }, []);

  const requestCategoryDelete = useCallback((id: string) => {
    setDeleteCascade(false);
    setDeleteId(id);
  }, []);

  const handleQuickTxSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!quickTxCategory?.id) return;
    if (!quickTxWalletId) {
      enqueueSnackbar('Vyber pozici (účet + měnu)', { variant: 'warning' });
      return;
    }
    const amount = parseAmount(quickTxAmountCanon);
    if (amount == null || amount <= 0) {
      enqueueSnackbar('Zadej kladnou částku', { variant: 'warning' });
      return;
    }
    const amountScale = quickTxWallet?.assetScale ?? DEFAULT_FIAT_SCALE;
    const amountMinor = majorToMinorUnitsForScale(amount, amountScale);
    if (amountMinor <= 0) {
      const code = quickTxWallet?.currencyCode?.trim().toUpperCase() || 'měny';
      enqueueSnackbar(`Částka je menší než nejmenší jednotka ${code}.`, { variant: 'warning' });
      return;
    }
    const txDateIso = toIsoFromDatetimeLocal(quickTxWhen);
    if (!txDateIso) {
      enqueueSnackbar('Neplatné datum a čas — použij formát dd.MM.yyyy HH:mm', { variant: 'warning' });
      return;
    }
    const kind = quickTxCategory.categoryKind;
    if (
      kind !== CreateCategoryRequestDtoCategoryKind.EXPENSE &&
      kind !== CreateCategoryRequestDtoCategoryKind.INCOME
    ) {
      enqueueSnackbar('Kategorie nemá platný typ příjem/výdaj', { variant: 'warning' });
      return;
    }

    const payload: CreateTransactionRequestDto = {
      categoryId: quickTxCategory.id,
      holdingId: quickTxWalletId,
      amount: amountMinor,
      transactionDate: txDateIso,
      transactionType:
        kind === CreateCategoryRequestDtoCategoryKind.EXPENSE
          ? CreateTransactionRequestDtoTransactionType.EXPENSE
          : CreateTransactionRequestDtoTransactionType.INCOME,
      ...(quickTxDescription.trim() ? { description: quickTxDescription.trim() } : {}),
    };

    setSubmitting(true);
    try {
      const res = await transactionCreate(trackerId, payload);
      if (res.status < 200 || res.status >= 300) {
        enqueueSnackbar(apiErrorMessage(res.data, 'Transakci se nepodařilo uložit'), { variant: 'error' });
        return;
      }
      enqueueSnackbar('Transakce byla zaznamenána', { variant: 'success' });
      setQuickTxCategory(null);
      await queryClient.invalidateQueries({ queryKey: [`/api/transaction/${trackerId}`] });
      await queryClient.invalidateQueries({ queryKey: [`/api/holding/${trackerId}`] });
      await queryClient.invalidateQueries({ queryKey: [`/api/institution/${trackerId}/dashboard`] });
      await invalidateBudgets();
    } catch {
      enqueueSnackbar('Transakci se nepodařilo uložit', { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box>
      {!embedded && (
        <PageHeading component="h1" gutterBottom>
          Kategorie
        </PageHeading>
      )}

      {isError && (
        <Typography color="error" sx={{ mb: 2 }}>
          Nepodařilo se načíst kategorie.
        </Typography>
      )}

      {!categoriesQueryEnabled || isLoading ? (
        <>
          <Typography color="text.secondary">Načítám…</Typography>
        </>
      ) : (
        <>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 4,
              mb: 2,
              flexWrap: 'wrap',
            }}
          >
            <Stack spacing={0.5} sx={{ flex: '0 1 780px', minWidth: 0 }}>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(210px, 0.9fr) minmax(210px, 0.9fr)',
                  columnGap: 4,
                  alignItems: 'start',
                }}
              >
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) auto',
                    columnGap: 0.5,
                    rowGap: 0.5,
                    alignItems: 'baseline',
                    minWidth: 0,
                  }}
                >
                  <Typography color="text.secondary" variant={embedded ? 'body2' : 'body1'}>
                    Predpokládané měsíční výdaje:
                  </Typography>
                  <Typography
                    color="text.secondary"
                    variant={embedded ? 'body2' : 'body1'}
                    sx={{ fontWeight: 600, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
                  >
                    {predictedMonthlyExpenseText}
                  </Typography>
                  <Typography color="text.secondary" variant={embedded ? 'body2' : 'body1'}>
                    Predpokládané měsíční příjmy:
                  </Typography>
                  <Typography
                    color="text.secondary"
                    variant={embedded ? 'body2' : 'body1'}
                    sx={{ fontWeight: 600, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
                  >
                    {predictedMonthlyIncomeText}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) auto',
                    columnGap: 0.5,
                    rowGap: 0.5,
                    alignItems: 'baseline',
                    minWidth: 0,
                    borderLeft: 1,
                    borderColor: 'divider',
                    pl: 2,
                  }}
                >
                  <Typography color="text.secondary" variant={embedded ? 'body2' : 'body1'}>
                    Skutečné měsíční výdaje:
                  </Typography>
                  <Typography
                    color="text.secondary"
                    variant={embedded ? 'body2' : 'body1'}
                    sx={{ fontWeight: 600, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
                  >
                    {actualMonthlyExpenseText}
                  </Typography>
                  <Typography color="text.secondary" variant={embedded ? 'body2' : 'body1'}>
                    Skutečné měsíční příjmy:
                  </Typography>
                  <Typography
                    color="text.secondary"
                    variant={embedded ? 'body2' : 'body1'}
                    sx={{ fontWeight: 600, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
                  >
                    {actualMonthlyIncomeText}
                  </Typography>
                </Box>
              </Box>
              <Divider sx={{ my: 0.5 }} />
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(210px, 0.9fr) minmax(210px, 0.9fr)',
                  columnGap: 4,
                  alignItems: 'start',
                }}
              >
                <Tooltip title={`Při tomto tempu za rok: ${predictedSavingsYearlyText}`}>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0, 1fr) auto',
                      columnGap: 0.5,
                      alignItems: 'baseline',
                      minWidth: 0,
                      cursor: 'help',
                    }}
                  >
                    <Typography color="text.secondary" variant={embedded ? 'body2' : 'body1'}>
                      Predpokládaná měsíční úspora:
                    </Typography>
                    <Box
                      sx={{
                        textAlign: 'right',
                        fontVariantNumeric: 'tabular-nums',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {renderColoredSavingsAmounts(predictedMonthlySavingsBuckets)}
                    </Box>
                  </Box>
                </Tooltip>
                <Tooltip title={`Při tomto tempu za rok: ${actualSavingsYearlyText}`}>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0, 1fr) auto',
                      columnGap: 0.5,
                      alignItems: 'baseline',
                      minWidth: 0,
                      cursor: 'help',
                      borderLeft: 1,
                      borderColor: 'divider',
                      pl: 2,
                    }}
                  >
                    <Typography color="text.secondary" variant={embedded ? 'body2' : 'body1'}>
                      Skutečná měsíční úspora:
                    </Typography>
                    <Box
                      sx={{
                        textAlign: 'right',
                        fontVariantNumeric: 'tabular-nums',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {renderColoredSavingsAmounts(actualMonthlySavingsBuckets)}
                    </Box>
                  </Box>
                </Tooltip>
              </Box>
            </Stack>
          </Box>
          <Box sx={{ mb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
            <Box>
              {tree.length > 0 && categoryIdsWithChildren.length > 0 ? (
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <Tooltip title={allCategoriesExpanded ? 'Sbalit všechny podstromy' : 'Rozbalit všechny podstromy'}>
                    <IconButton
                      size="small"
                      onClick={toggleExpandAllCategories}
                      aria-expanded={allCategoriesExpanded}
                      aria-label={allCategoriesExpanded ? 'collapseAll' : 'expandAll'}
                    >
                      <ChevronRightIcon
                        fontSize="small"
                        sx={{
                          transition: (t) =>
                            t.transitions.create('transform', { duration: t.transitions.duration.shorter }),
                          transform: allCategoriesExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                        }}
                      />
                    </IconButton>
                  </Tooltip>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    component="button"
                    type="button"
                    onClick={toggleExpandAllCategories}
                    sx={{
                      cursor: 'pointer',
                      border: 'none',
                      background: 'none',
                      font: 'inherit',
                      p: 0,
                      textDecoration: 'none',
                      '&:hover': { textDecoration: 'underline' },
                    }}
                  >
                    {allCategoriesExpanded ? 'collapseAll' : 'expandAll'}
                  </Typography>
                </Stack>
              ) : null}
            </Box>
            <Stack direction="row" spacing={1} sx={{ flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <Button
                variant="text"
                startIcon={showOnlyCategoriesWithMovements ? <VisibilityOffIcon /> : <VisibilityIcon />}
                onClick={() => setShowOnlyCategoriesWithMovements((prev) => !prev)}
              >
                {showOnlyCategoriesWithMovements ? 'Zobrazit vše' : 'Zobrazit jen pohyby'}
              </Button>
              <Tooltip title="Z aktivních opakujících se šablon vytvoří nebo doplní konkrétní rozpočty (budget plány) pro aktuální období.">
                <span>
                  <Button
                    variant="outlined"
                    startIcon={<SyncOutlinedIcon />}
                    onClick={handleSyncRecurringBudgets}
                    disabled={!trackerId || syncRecurringBudgetsSubmitting}
                  >
                    Rozpočty ze šablon
                  </Button>
                </span>
              </Tooltip>
              <Button variant="outlined" onClick={openBulkCreate}>
                Hromadně přidat
              </Button>
              <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={openCreateRoot}>
                Přidat kategorii
              </Button>
            </Stack>
          </Box>
          <Paper variant="outlined" sx={{ p: 2 }}>
            {filteredTree.length === 0 ? (
              <Typography color="text.secondary">Zatím žádná kategorie — přidej první.</Typography>
            ) : (
              <Stack spacing={0}>
                {filteredTree.map((node, idx) => (
                  <CategoryTreeRows
                    key={node.id ?? node.name}
                    node={node}
                    depth={0}
                    siblingIndex={idx}
                    siblings={filteredTree}
                    rowSubmitting={submitting}
                    onAddChild={openCreateChild}
                    onEdit={openEdit}
                    onDelete={requestCategoryDelete}
                    onManageBudgets={setBudgetCategory}
                    onQuickAddTransaction={handleQuickTxOpen}
                    onSwapSiblingOrder={handleSwapSiblingOrder}
                    getBudgetCount={getBudgetCount}
                    getOneOffBudgets={getOneOffBudgets}
                    expandedCategoryIds={expandedCategoryIds}
                    onToggleCategoryExpand={toggleCategoryExpand}
                  />
                ))}
              </Stack>
            )}
          </Paper>
        </>
      )}

      <Dialog
        open={createOpen}
        onClose={() => !submitting && setCreateOpen(false)}
        fullWidth
        maxWidth="sm"
        disableAutoFocus
        slotProps={{
          transition: {
            onEntered: () => {
              createNameInputRef.current?.focus();
            },
          },
        }}
      >
        <DialogTitle>
          {createMode.type === 'child' ? 'Nová podkategorie' : 'Nová kategorie'}
        </DialogTitle>
        <Box component="form" onSubmit={handleCreate}>
          <DialogContent>
            <Stack spacing={2}>
              <TextField
                label="Název"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
                fullWidth
                inputRef={createNameInputRef}
              />
              <FormControl fullWidth>
                <InputLabel id="create-kind">Druh</InputLabel>
                <Select
                  labelId="create-kind"
                  label="Druh"
                  value={formKind}
                  onChange={(e) =>
                    setFormKind(e.target.value as CreateCategoryRequestDtoCategoryKind)
                  }
                >
                  <MenuItem value={CreateCategoryRequestDtoCategoryKind.EXPENSE}>Výdaj</MenuItem>
                  <MenuItem value={CreateCategoryRequestDtoCategoryKind.INCOME}>Příjem</MenuItem>
                </Select>
              </FormControl>
              {createMode.type === 'root' && (
                <FormControl fullWidth>
                  <InputLabel id="create-parent">Nadřazená (volitelné)</InputLabel>
                  <Select
                    labelId="create-parent"
                    label="Nadřazená (volitelné)"
                    value={formParentId}
                    onChange={(e) => setFormParentId(e.target.value as string)}
                  >
                    <MenuItem value="">
                      <em>Kořen</em>
                    </MenuItem>
                    {parentOptionsForCreate.map((o) => (
                      <MenuItem key={o.id} value={o.id}>
                        {o.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button type="button" onClick={() => setCreateOpen(false)} disabled={submitting}>
              Zrušit
            </Button>
            <Button type="submit" variant="contained" disabled={submitting}>
              Vytvořit
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog
        open={Boolean(quickTxCategory)}
        onClose={() => !submitting && setQuickTxCategory(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Přidat transakci</DialogTitle>
        <Box component="form" onSubmit={handleQuickTxSubmit}>
          <DialogContent>
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                Kategorie: <strong>{quickTxCategory?.name ?? '—'}</strong>
              </Typography>
              <FormControl fullWidth required size="small">
                <InputLabel id="quick-tx-wallet">Pozice</InputLabel>
                <Select
                  labelId="quick-tx-wallet"
                  label="Pozice"
                  value={quickTxWalletId}
                  onChange={(e) => setQuickTxWalletId(e.target.value as string)}
                >
                  {activeWallets.map((w) => (
                    <MenuItem key={w.id} value={w.id}>
                      {w.name ?? w.id} {w.currencyCode ? `(${w.currencyCode})` : ''}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Částka"
                value={formatAmountDisplayCs(quickTxAmountCanon)}
                onChange={(e) => setQuickTxAmountCanon(canonicalAmountFromUserInput(e.target.value))}
                required
                fullWidth
                size="small"
                inputMode="decimal"
                helperText={
                  quickTxWallet?.currencyCode?.trim().toUpperCase() === 'BTC'
                    ? '1 satoshi zadej jako 0,00000001 BTC.'
                    : undefined
                }
              />
              <TextField
                label="Datum a čas"
                value={quickTxWhen}
                onChange={(e) => setQuickTxWhen(e.target.value)}
                placeholder="dd.MM.yyyy HH:mm"
                helperText="Formát dd.MM.yyyy HH:mm (24 h)"
                required
                fullWidth
                size="small"
              />
              <TextField
                label="Popis (volitelné)"
                value={quickTxDescription}
                onChange={(e) => setQuickTxDescription(e.target.value)}
                fullWidth
                size="small"
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setQuickTxCategory(null)} disabled={submitting}>
              Zrušit
            </Button>
            <Button type="submit" variant="contained" disabled={submitting}>
              Uložit transakci
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog open={bulkOpen} onClose={() => !submitting && setBulkOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Hromadné vytvoření kategorií</DialogTitle>
        <Box component="form" onSubmit={handleBulkCreate}>
          <DialogContent>
            <Stack spacing={2}>
              <FormControl fullWidth size="small">
                <InputLabel id="bulk-kind">Druh</InputLabel>
                <Select
                  labelId="bulk-kind"
                  label="Druh"
                  value={bulkKind}
                  onChange={(e) => setBulkKind(e.target.value as CreateCategoryRequestDtoCategoryKind)}
                >
                  <MenuItem value={CreateCategoryRequestDtoCategoryKind.EXPENSE}>Výdaj</MenuItem>
                  <MenuItem value={CreateCategoryRequestDtoCategoryKind.INCOME}>Příjem</MenuItem>
                </Select>
              </FormControl>
              <TextField
                label="Kategorie (po řádcích)"
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={'Domácnost\n  Nájem\n  Energie\nJídlo\n  Restaurace'}
                helperText="Hierarchie: 2 mezery (nebo tab) = 1 úroveň. Max 5 úrovní."
                multiline
                minRows={10}
                fullWidth
                required
              />
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  Náhled stromu
                </Typography>
                <Paper variant="outlined" sx={{ p: 1, maxHeight: 220, overflow: 'auto' }}>
                  {bulkPreview.rows.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      Napiš kategorie a hierarchii odsazením; náhled se zobrazí průběžně.
                    </Typography>
                  ) : (
                    <Stack spacing={0.25}>
                      {bulkPreview.rows.map((row, idx) => (
                        <Box key={`${idx}-${row.name}`} sx={{ display: 'flex', alignItems: 'center', minHeight: 22 }}>
                          {row.level > 0 && (
                            <>
                              <Box sx={{ display: 'flex', alignSelf: 'stretch', mr: 0.25 }}>
                                {Array.from({ length: row.level }).map((_, i) => (
                                  <Box
                                    key={i}
                                    sx={{
                                      width: 12,
                                      borderLeft: 1,
                                      borderColor: 'divider',
                                      opacity: 0.7,
                                    }}
                                  />
                                ))}
                              </Box>
                              <Box
                                sx={{
                                  width: 8,
                                  borderTop: 1,
                                  borderColor: 'divider',
                                  opacity: 0.7,
                                  mr: 0.5,
                                  flexShrink: 0,
                                }}
                              />
                            </>
                          )}
                          <Typography variant="body2" sx={{ minWidth: 0 }}>
                            {row.name}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  )}
                </Paper>
                {bulkPreview.error ? (
                  <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 0.5 }}>
                    {bulkPreview.error}
                  </Typography>
                ) : null}
              </Box>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button type="button" onClick={() => setBulkOpen(false)} disabled={submitting}>
              Zrušit
            </Button>
            <Button type="submit" variant="contained" disabled={submitting}>
              Vytvořit hromadně
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog open={Boolean(editState)} onClose={() => !submitting && setEditState(null)} fullWidth maxWidth="sm">
        <DialogTitle>Upravit kategorii</DialogTitle>
        <Box component="form" onSubmit={handleUpdate}>
          <DialogContent>
            <Stack spacing={2}>
              <TextField
                label="Název"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
                fullWidth
              />
              <FormControl fullWidth>
                <InputLabel id="edit-kind">Druh</InputLabel>
                <Select
                  labelId="edit-kind"
                  label="Druh"
                  value={formKind}
                  onChange={(e) =>
                    setFormKind(e.target.value as CreateCategoryRequestDtoCategoryKind)
                  }
                >
                  <MenuItem value={CreateCategoryRequestDtoCategoryKind.EXPENSE}>Výdaj</MenuItem>
                  <MenuItem value={CreateCategoryRequestDtoCategoryKind.INCOME}>Příjem</MenuItem>
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel id="edit-parent">Nadřazená</InputLabel>
                <Select
                  labelId="edit-parent"
                  label="Nadřazená"
                  value={formParentId}
                  onChange={(e) => setFormParentId(e.target.value as string)}
                >
                  <MenuItem value="">
                    <em>Kořen</em>
                  </MenuItem>
                  {parentOptionsForEdit.map((o) => (
                    <MenuItem key={o.id} value={o.id}>
                      {o.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button type="button" onClick={() => setEditState(null)} disabled={submitting}>
              Zrušit
            </Button>
            <Button type="submit" variant="contained" disabled={submitting}>
              Uložit
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog
        open={Boolean(deleteId)}
        onClose={() => {
          if (submitting) return;
          setDeleteId(null);
          setDeleteCascade(false);
        }}
      >
        <DialogTitle>Odstranit kategorii?</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            Opravdu chceš tuto kategorii odstranit? Bez kaskády může server odmítnout mazání, pokud existují
            podkategorie.
          </Typography>
          <FormControlLabel
            control={
              <Checkbox
                checked={deleteCascade}
                onChange={(_, c) => setDeleteCascade(c)}
                disabled={submitting}
              />
            }
            label="Smazat včetně podkategorií (kaskáda)"
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setDeleteId(null);
              setDeleteCascade(false);
            }}
            disabled={submitting}
          >
            Zrušit
          </Button>
          <Button color="error" variant="contained" onClick={handleDelete} disabled={submitting}>
            Odstranit
          </Button>
        </DialogActions>
      </Dialog>

      <CategoryBudgetPlansDialog
        open={Boolean(budgetCategory)}
        category={budgetCategory}
        trackerId={trackerId}
        plans={budgetCategory?.id ? budgetsByCategoryId.get(budgetCategory.id) ?? [] : []}
        recurringPlans={
          budgetCategory?.id ? recurringByCategoryId.get(budgetCategory.id) ?? [] : []
        }
        onClose={() => setBudgetCategory(null)}
        onInvalidate={invalidateBudgets}
      />
    </Box>
  );
};

export const CategoriesForTracker = memo(CategoriesForTrackerInner, categoriesForTrackerPropsEqual);

type RowProps = {
  node: CategoryResponseDto;
  depth: number;
  siblingIndex: number;
  siblings: CategoryResponseDto[];
  rowSubmitting: boolean;
  onAddChild: (parentId: string) => void;
  onEdit: (c: CategoryResponseDto) => void;
  onDelete: (id: string) => void;
  onManageBudgets: (c: CategoryResponseDto) => void;
  onQuickAddTransaction: (c: CategoryResponseDto) => void;
  onSwapSiblingOrder: (
    categoryId: string,
    siblingId: string,
    categorySortOrder: number,
    siblingSortOrder: number,
  ) => void;
  getBudgetCount: (categoryId: string) => number;
  getOneOffBudgets: (categoryId: string) => BudgetPlanResponseDto[];
  expandedCategoryIds: Set<string>;
  onToggleCategoryExpand: (categoryId: string) => void;
};

const CategoryTreeRows = memo(function CategoryTreeRows({
  node,
  depth,
  siblingIndex,
  siblings,
  rowSubmitting,
  onAddChild,
  onEdit,
  onDelete,
  onManageBudgets,
  onQuickAddTransaction,
  onSwapSiblingOrder,
  getBudgetCount,
  getOneOffBudgets,
  expandedCategoryIds,
  onToggleCategoryExpand,
}: RowProps) {
  const id = node.id;
  const children = asCategoryChildren(node.children);
  const hasChildren = children.length > 0;
  const expanded = Boolean(id && expandedCategoryIds.has(id));

  const toggleExpanded = () => {
    if (hasChildren && id) onToggleCategoryExpand(id);
  };

  const budgetCount = id ? getBudgetCount(id) : 0;
  const oneOffPlans = id ? getOneOffBudgets(id) : [];
  const prevSibling = siblingIndex > 0 ? siblings[siblingIndex - 1] : undefined;
  const nextSibling = siblingIndex < siblings.length - 1 ? siblings[siblingIndex + 1] : undefined;
  const currentSort = node.sortOrder ?? siblingIndex;
  const prevSort = prevSibling?.sortOrder ?? siblingIndex - 1;
  const nextSort = nextSibling?.sortOrder ?? siblingIndex + 1;

  return (
    <Box>
      <Box
        sx={{
          py: 0.75,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'grid',
          alignItems: 'center',
          columnGap: 0.5,
          gridTemplateColumns: `36px minmax(150px, 2fr) 36px ${CATEGORY_BUDGET_LIST_ROW_GRID_INNER} 72px 170px`,
          transition: (t) =>
            t.transitions.create('background-color', { duration: t.transitions.duration.shortest }),
          '&:hover': {
            bgcolor: (t) =>
              t.palette.mode === 'dark'
                ? alpha(t.palette.common.white, 0.1)
                : alpha(t.palette.common.black, 0.055),
          },
        }}
      >
        <Box
          sx={{
            width: 36,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {hasChildren ? (
            <IconButton
              size="small"
              aria-expanded={expanded}
              aria-label={expanded ? 'Sbalit podkategorie' : 'Rozbalit podkategorie'}
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded();
              }}
            >
              <ChevronRightIcon
                fontSize="small"
                sx={{
                  transition: (t) => t.transitions.create('transform', { duration: t.transitions.duration.shorter }),
                  transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
                }}
              />
            </IconButton>
          ) : null}
        </Box>
        <Typography
          sx={{
            width: '100%',
            minWidth: 0,
            pl: depth * 2.5,
            cursor: hasChildren ? 'pointer' : 'default',
            userSelect: 'none',
          }}
          noWrap
          title={node.name}
          onClick={toggleExpanded}
        >
          {node.name ?? '—'}
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          {id ? (
            <Tooltip title="Přidat transakci do této kategorie">
              <IconButton
                size="small"
                aria-label="přidat transakci"
                onClick={(e) => {
                  e.stopPropagation();
                  onQuickAddTransaction(node);
                }}
              >
                <PostAddIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          ) : (
            <Box sx={{ width: 32 }} />
          )}
        </Box>
        {oneOffPlans.length === 0 ? (
          <Typography
            variant="caption"
            color="text.disabled"
            sx={{ whiteSpace: 'nowrap', gridColumn: '4 / 9', alignSelf: 'center' }}
          >
            —
          </Typography>
        ) : oneOffPlans.length === 1 ? (
          <CategoryBudgetPlanUsageLine
            plan={oneOffPlans[0]}
            categoryKind={node.categoryKind as 'INCOME' | 'EXPENSE' | undefined}
            variant="listRow"
            gridCells
          />
        ) : (
          <Box
            sx={{
              gridColumn: '4 / 9',
              minWidth: 0,
              overflowX: 'auto',
              overflowY: 'hidden',
              alignSelf: 'center',
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 0.25 }}>
              {oneOffPlans.map((p) => (
                <Box
                  key={p.id ?? p.name}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: CATEGORY_BUDGET_LIST_ROW_GRID_INNER,
                    columnGap: 0.5,
                    alignItems: 'center',
                    flexShrink: 0,
                    minWidth: 0,
                  }}
                >
                  <CategoryBudgetPlanUsageLine
                    plan={p}
                    categoryKind={node.categoryKind as 'INCOME' | 'EXPENSE' | undefined}
                    variant="listRow"
                    gridCells
                  />
                </Box>
              ))}
            </Stack>
          </Box>
        )}
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Chip
            size="small"
            label={categoryKindLabel(node.categoryKind)}
            variant="outlined"
            color={categoryKindChipColor(node.categoryKind)}
          />
        </Box>
        <Stack direction="row" spacing={0} alignItems="center" sx={{ justifySelf: 'end' }}>
          {id && (
            <>
              <Tooltip title="Posunout výš">
                <span>
                  <IconButton
                    size="small"
                    aria-label="posunout kategorii výš"
                    disabled={!prevSibling?.id || rowSubmitting}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!prevSibling?.id) return;
                      onSwapSiblingOrder(id, prevSibling.id, currentSort, prevSort);
                    }}
                  >
                    <ArrowUpwardIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Posunout níž">
                <span>
                  <IconButton
                    size="small"
                    aria-label="posunout kategorii níž"
                    disabled={!nextSibling?.id || rowSubmitting}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!nextSibling?.id) return;
                      onSwapSiblingOrder(id, nextSibling.id, currentSort, nextSort);
                    }}
                  >
                    <ArrowDownwardIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title={budgetCount > 0 ? `Rozpočty (${budgetCount})` : 'Rozpočet ke kategorii'}>
                <IconButton
                  size="small"
                  aria-label="rozpočty kategorie"
                  onClick={(e) => {
                    e.stopPropagation();
                    onManageBudgets(node);
                  }}
                  color={budgetCount > 0 ? 'primary' : 'default'}
                >
                  <AccountBalanceWalletOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Podkategorie">
                <IconButton
                  size="small"
                  aria-label="přidat podkategorii"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddChild(id);
                  }}
                >
                  <AddOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Upravit">
                <IconButton
                  size="small"
                  aria-label="upravit"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(node);
                  }}
                >
                  <EditOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Odstranit">
                <IconButton
                  size="small"
                  aria-label="odstranit"
                  color="error"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(id);
                  }}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          )}
        </Stack>
      </Box>
      {hasChildren && (
        <Collapse in={expanded} timeout="auto" unmountOnExit>
          <Box>
            {children.map((ch, idx) => (
              <CategoryTreeRows
                key={ch.id ?? ch.name}
                node={ch}
                depth={depth + 1}
                siblingIndex={idx}
                siblings={children}
                rowSubmitting={rowSubmitting}
                onAddChild={onAddChild}
                onEdit={onEdit}
                onDelete={onDelete}
                onManageBudgets={onManageBudgets}
                onQuickAddTransaction={onQuickAddTransaction}
                onSwapSiblingOrder={onSwapSiblingOrder}
                getBudgetCount={getBudgetCount}
                getOneOffBudgets={getOneOffBudgets}
                expandedCategoryIds={expandedCategoryIds}
                onToggleCategoryExpand={onToggleCategoryExpand}
              />
            ))}
          </Box>
        </Collapse>
      )}
    </Box>
  );
});

CategoryTreeRows.displayName = 'CategoryTreeRows';
