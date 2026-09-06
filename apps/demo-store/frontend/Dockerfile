FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev express
COPY dist ./dist
COPY public ./public
EXPOSE 4002
CMD ["node", "dist/index.js"]
