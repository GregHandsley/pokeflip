# infra/docker/web.Dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files (with the updated package.json that includes @vitejs/plugin-react)
COPY apps/web/package.json apps/web/package-lock.json* ./ 

# Fix the npm ARM64 bug by removing package-lock.json and node_modules, then reinstalling
RUN rm -rf package-lock.json node_modules && npm install

# Copy source code
COPY apps/web/ ./

EXPOSE 5173
CMD ["npm","run","dev","--","--host","0.0.0.0"]
