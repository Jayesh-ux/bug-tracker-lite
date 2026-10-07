export const openapiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Bug Tracker Lite API',
    version: '1.0.0',
    description:
      'Bug Tracker Lite — Express + PostgreSQL + S3. Images are uploaded by the browser directly to S3 using a pre-signed POST; the API never receives image bytes.',
  },
  servers: [
    { url: '/api', description: 'API prefix' },
  ],
  tags: [
    { name: 'auth', description: 'Signup / login' },
    { name: 'bugs', description: 'Bug CRUD + image upload URLs' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
        },
      },
      Bug: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          title: { type: 'string', maxLength: 200 },
          description: { type: 'string', maxLength: 5000 },
          severity: { type: 'string', enum: ['low', 'med', 'high'] },
          status: { type: 'string', enum: ['open', 'in-progress', 'closed'] },
          imageKey: { type: 'string', nullable: true },
          imageUrl: { type: 'string', nullable: true },
          hasImage: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Error: {
        type: 'object',
        properties: { error: { type: 'string' } },
      },
      UploadUrlRequest: {
        type: 'object',
        required: ['contentType', 'size'],
        properties: {
          contentType: { type: 'string', enum: ['image/jpeg', 'image/png', 'image/webp'] },
          size: { type: 'integer', minimum: 1, maximum: 5242880, description: 'file size in bytes (1..5 MB)' },
        },
      },
      UploadUrlResponse: {
        type: 'object',
        properties: {
          url: { type: 'string' },
          fields: { type: 'object' },
          key: { type: 'string' },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['auth'],
        summary: 'Health check',
        responses: {
          '200': {
            description: 'Service status',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
    },
    '/auth/signup': {
      post: {
        tags: ['auth'],
        summary: 'Create an account (rate limited: 5/min/IP)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'password'],
                properties: {
                  name: { type: 'string', minLength: 2 },
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8 },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    token: { type: 'string' },
                    user: { $ref: '#/components/schemas/User' },
                  },
                },
              },
            },
          },
          '400': { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '409': { description: 'Email already registered', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '429': { description: 'Rate limit reached', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['auth'],
        summary: 'Log in (rate limited: 5/min/IP)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    token: { type: 'string' },
                    user: { $ref: '#/components/schemas/User' },
                  },
                },
              },
            },
          },
          '400': { description: 'Missing fields', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '401': { description: 'Invalid email or password', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '429': { description: 'Rate limit reached', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/bugs': {
      post: {
        security: [{ bearerAuth: [] }],
        tags: ['bugs'],
        summary: 'Create a bug',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title', 'severity'],
                properties: {
                  title: { type: 'string', maxLength: 200 },
                  description: { type: 'string', maxLength: 5000 },
                  severity: { type: 'string', enum: ['low', 'med', 'high'] },
                  status: { type: 'string', enum: ['open', 'in-progress', 'closed'], default: 'open' },
                  imageKey: { type: 'string', nullable: true, description: 'must start with uploads/<yourUserId>/' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Bug' } } } },
          '400': { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
      get: {
        security: [{ bearerAuth: [] }],
        tags: ['bugs'],
        summary: 'List your bugs (newest first)',
        parameters: [
          {
            name: 'status',
            in: 'query',
            required: false,
            schema: { type: 'string', enum: ['open', 'in-progress', 'closed'] },
          },
        ],
        responses: {
          '200': {
            description: 'List of bugs',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Bug' } } } },
          },
          '400': { description: 'Invalid status filter', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/bugs/upload-url': {
      post: {
        security: [{ bearerAuth: [] }],
        tags: ['bugs'],
        summary: 'Get a pre-signed S3 POST policy to upload a screenshot',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/UploadUrlRequest' } } },
        },
        responses: {
          '200': {
            description: 'Pre-signed POST',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/UploadUrlResponse' } } },
          },
          '400': { description: 'Invalid contentType/size', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/bugs/{id}': {
      get: {
        security: [{ bearerAuth: [] }],
        tags: ['bugs'],
        summary: 'Get one of your bugs (adds a 5-minute pre-signed imageUrl if it has an image)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'Bug', content: { 'application/json': { schema: { $ref: '#/components/schemas/Bug' } } } },
          '404': { description: 'Bug not found (also returned for other users bugs)', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
      put: {
        security: [{ bearerAuth: [] }],
        tags: ['bugs'],
        summary: 'Partially update a bug',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string', maxLength: 200 },
                  description: { type: 'string', maxLength: 5000 },
                  severity: { type: 'string', enum: ['low', 'med', 'high'] },
                  status: { type: 'string', enum: ['open', 'in-progress', 'closed'] },
                  imageKey: { type: 'string', nullable: true },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Updated bug', content: { 'application/json': { schema: { $ref: '#/components/schemas/Bug' } } } },
          '400': { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '404': { description: 'Bug not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
      delete: {
        security: [{ bearerAuth: [] }],
        tags: ['bugs'],
        summary: 'Delete a bug and its S3 screenshot',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'Deleted', content: { 'application/json': { schema: { type: 'object', properties: { message: { type: 'string' } } } } } },
          '404': { description: 'Bug not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
  },
}