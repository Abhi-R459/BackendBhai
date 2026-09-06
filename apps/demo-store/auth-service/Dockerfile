FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev express
COPY dist ./dist
EXPOSE 3001
CMD ["node", "dist/index.js"]
