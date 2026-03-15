FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Clean install to resolve any dependency issues
RUN npm ci

# Copy the rest of the application code
COPY . .

# Build the Next.js application
ARG NEXT_PUBLIC_LIVEKIT_URL
ENV NEXT_PUBLIC_LIVEKIT_URL=$NEXT_PUBLIC_LIVEKIT_URL
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ARG INTERNAL_BACKEND_URL
ENV INTERNAL_BACKEND_URL=$INTERNAL_BACKEND_URL
ARG INTERNAL_LIVEKIT_URL
ENV INTERNAL_LIVEKIT_URL=$INTERNAL_LIVEKIT_URL

RUN npm run build

EXPOSE 3000

# Start the application
CMD ["npm", "start"]
