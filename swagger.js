const swaggerJSDoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: '機台管理系統 API',
      version: '1.0.0',
      description: '提供機台管理相關的 API 文件',
    },
    servers: [
      {
        url: 'frank.tsungyin.tw:5002',
        description: '設備/保養維修管理系統',
      },
    ],
  },
  apis: ['./routes/*.js'], // 指向含有 JSDoc 註解的檔案
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = swaggerSpec;
