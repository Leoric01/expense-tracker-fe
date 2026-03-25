/** @type {import('orval').Config} */
export default {
  expenseTracker: {
    input: {
      target: 'http://localhost:8081/v3/api-docs', 
    },
    output: {
      mode: 'tags-split',
      target: 'src/api/',
      schemas: 'src/api/model',
      client: 'react-query',
      prettier: true,
    },
  },
};