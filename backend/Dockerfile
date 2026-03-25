# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /build

COPY package.json package-lock.json .npmrc ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

# Stage 2: Production image
FROM public.ecr.aws/lambda/nodejs:20

# Copy compiled output
COPY --from=builder /build/dist ${LAMBDA_TASK_ROOT}/

# Copy production dependencies only
COPY package.json package-lock.json .npmrc ${LAMBDA_TASK_ROOT}/
RUN npm ci --omit=dev

CMD ["handler.handler"]
