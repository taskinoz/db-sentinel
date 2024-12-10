# Base image
FROM node:18

# Set the working directory inside the container
WORKDIR /app

# Copy application files
COPY package*.json ./
COPY . .

# Install dependencies
RUN npm install

# Expose the application port
EXPOSE 3000

# Run the application
CMD ["node", "app.js"]
