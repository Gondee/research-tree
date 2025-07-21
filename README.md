# Research Tree - Hierarchical Research Automation Tool

A powerful research automation platform that enables users to conduct deep, hierarchical research at scale using OpenAI's Deep Research API and Gemini's large context window for data synthesis.

## Features

- **Parallel Research Processing**: Execute 10-100+ research tasks simultaneously
- **Hierarchical Research Tree**: Visualize and navigate multi-level research structures
- **AI-Powered Table Generation**: Use Gemini to structure research outputs into tables
- **Interactive Data Management**: Edit and export tables at any level
- **Real-time Progress Tracking**: Monitor research progress with live updates
- **CSV Export**: Export structured data for further analysis

## Prerequisites

- Node.js 18+ 
- PostgreSQL database (or Vercel Postgres)
- OpenAI API key (for Deep Research API)
- Google Gemini API key
- Inngest account (for background job processing)

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
cd research-tree
npm install
```

### 2. Environment Variables

Copy `.env.example` to `.env.local` and fill in your credentials:

```bash
cp .env.example .env.local
```

Required environment variables:
- `POSTGRES_*` - Database connection strings
- `NEXTAUTH_SECRET` - Generate with: `openssl rand -base64 32`
- `OPENAI_API_KEY` - Your OpenAI API key
- `GEMINI_API_KEY` - Your Google Gemini API key
- `INNGEST_EVENT_KEY` & `INNGEST_SIGNING_KEY` - From your Inngest dashboard

### 3. Database Setup

Generate the Prisma client and create database tables:

```bash
npx prisma generate
npx prisma db push
```

For production, use migrations instead:
```bash
npx prisma migrate dev --name init
```

### 4. Run Development Server

```bash
npm run dev
```

Visit http://localhost:3000

### 5. Set up Inngest (for background jobs)

1. Install the Inngest CLI:
```bash
npm install -g inngest-cli
```

2. Run the Inngest dev server:
```bash
npx inngest-cli dev
```

## Project Structure

```
src/
├── app/                    # Next.js app router pages
│   ├── api/               # API routes
│   ├── auth/              # Authentication pages
│   └── (dashboard)/       # Main app pages
├── components/            # React components
│   ├── ui/               # Base UI components
│   ├── research-tree/    # Tree visualization
│   ├── data-table/       # Table component
│   └── progress-tracker/ # Progress monitoring
├── lib/                   # Utilities and API clients
│   ├── openai-client.ts  # OpenAI integration
│   ├── gemini-client.ts  # Gemini integration
│   └── inngest/          # Background job functions
├── stores/               # Zustand state management
└── types/                # TypeScript definitions
```

## Usage Guide

### Creating a Research Session

1. Log in to your account
2. Click "New Research Session"
3. Enter a session name and initial research prompt
4. Click "Start Research"

### Building Research Hierarchies

1. Wait for initial research to complete
2. Click "Add Level" on a completed node
3. Use variables from the parent table in your prompt template:
   - Example: `Research {company_name} in {region}`
4. Select which columns to use from the parent table
5. Start the next level of research

### Managing Tables

1. Click on any completed node to view its generated table
2. Use the Gemini prompt to structure the data:
   - Example: "Extract company name, funding, and key products"
3. Edit table data directly in the interface
4. Export to CSV for external analysis

## API Integration Notes

### OpenAI Deep Research API
- The integration assumes a `/deep-research` endpoint
- Adjust the endpoint in `src/lib/openai-client.ts` based on actual API

### Google Gemini API
- Uses Gemini 1.5 Flash for table generation
- Supports structured JSON output
- Large context window for processing multiple research reports

## Development

### Running Tests
```bash
npm test
```

### Building for Production
```bash
npm run build
```

### Database Migrations
```bash
npx prisma migrate dev
```

## Troubleshooting

### Database Connection Issues
- Ensure PostgreSQL is running
- Check connection strings in `.env.local`
- Verify SSL settings for production databases

### API Rate Limits
- The system implements exponential backoff
- Adjust concurrent task limits in Inngest functions
- Monitor API usage in respective dashboards

### Background Job Issues
- Check Inngest dashboard for job status
- Ensure Inngest dev server is running locally
- Verify webhook endpoints are accessible

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme).

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## License

MIT License - see LICENSE file for details
