FROM node:18-slim

# Install build dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    gcc \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

# Install node-pre-gyp globally
RUN npm install -g node-pre-gyp

RUN npm install

COPY . .

EXPOSE 3001

CMD ["npm", "start"] 