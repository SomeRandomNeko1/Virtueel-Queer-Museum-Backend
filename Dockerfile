FROM node:20-alpine

WORKDIR /app

# Copy package files first to leverage Docker caching
COPY package*.json ./

# Install dependencies (including your devDependencies like tailwind)
RUN npm install

# Copy the rest of your frontend code
COPY . .

# Expose the Vite default port
EXPOSE 5173

# Run the dev server
CMD ["npx", "vite", "--host"]