const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Getsocs API",
      version: "1.1.0",
      description: "Getsocs marketplace API. New integrations should prefer the /api/v1 route surface.",
    },
    components: {
      securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
      schemas: {
        Error: { type: "object", properties: { success: { type: "boolean", example: false }, error: { type: "string" }, requestId: { type: "string" } } },
        Success: { type: "object", required: ["success"], additionalProperties: true, properties: { success: { type: "boolean", example: true } } }
      }
    },
    servers: [
      { url: "https://getsocs.com/api/v1", description: "Production v1 (preferred)" },
      { url: "https://getsocs.com/api", description: "Production legacy compatibility surface" },
    ],
  },
  apis: ['./routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;