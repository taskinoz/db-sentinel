# Base image
FROM node:18

# Install PostgreSQL client for the desired version
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    && wget -qO - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add - \
    && echo "deb http://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
    && apt-get update \
    && apt-get install -y postgresql-client-16 default-mysql-client \
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
