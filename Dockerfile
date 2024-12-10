# Base image
FROM node:18

# Install PostgreSQL and MySQL client utilities
RUN apt-get update && apt-get install -y \
    postgresql-client \
    default-mysql-client \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application files
COPY . .

# Ensure the dumps directory exists
RUN mkdir -p /app/dumps

# Expose the application port
EXPOSE 3000

# Start the application
CMD ["node", "app.js"]
