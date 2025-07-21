import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Sparkles, 
  Users, 
  Zap, 
  Database, 
  BarChart3, 
  FileDown,
  ArrowRight,
  CheckCircle2
} from 'lucide-react'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h1 className="text-5xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Research Tree
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Conduct deep, hierarchical research at scale using AI. Transform complex research tasks into structured data with parallel processing and intelligent analysis.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/auth/register">
              <Button size="lg" className="gap-2">
                Get Started <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/auth/login">
              <Button size="lg" variant="outline">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">
          Powerful Research Automation
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <Zap className="h-10 w-10 text-primary mb-2" />
              <CardTitle>Parallel Processing</CardTitle>
              <CardDescription>
                Execute 10-100+ research tasks simultaneously with intelligent queue management
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <Database className="h-10 w-10 text-primary mb-2" />
              <CardTitle>AI-Powered Analysis</CardTitle>
              <CardDescription>
                Use OpenAI Deep Research and Google Gemini to extract and structure data
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <BarChart3 className="h-10 w-10 text-primary mb-2" />
              <CardTitle>Hierarchical Research</CardTitle>
              <CardDescription>
                Build multi-level research trees with data flowing between levels
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <Sparkles className="h-10 w-10 text-primary mb-2" />
              <CardTitle>Smart Table Generation</CardTitle>
              <CardDescription>
                Automatically convert research outputs into structured tables with AI
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <Users className="h-10 w-10 text-primary mb-2" />
              <CardTitle>Interactive Visualization</CardTitle>
              <CardDescription>
                Navigate research trees visually and track progress in real-time
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <FileDown className="h-10 w-10 text-primary mb-2" />
              <CardTitle>Export & Analysis</CardTitle>
              <CardDescription>
                Export structured data as CSV for further analysis and reporting
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>

      {/* How it Works */}
      <div className="container mx-auto px-4 py-16 bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            How It Works
          </h2>
          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold">
                  1
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-1">Start Your Research</h3>
                <p className="text-muted-foreground">
                  Enter your initial research prompt and let AI conduct comprehensive research
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold">
                  2
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-1">Structure Your Data</h3>
                <p className="text-muted-foreground">
                  Use AI to extract and organize research findings into structured tables
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold">
                  3
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-1">Go Deeper</h3>
                <p className="text-muted-foreground">
                  Use data from one level to spawn new research tasks, building a comprehensive knowledge tree
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold">
                  4
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-1">Export & Analyze</h3>
                <p className="text-muted-foreground">
                  Download your structured data as CSV for further analysis and insights
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="container mx-auto px-4 py-16">
        <Card className="max-w-2xl mx-auto bg-primary text-primary-foreground">
          <CardContent className="text-center py-12 space-y-6">
            <h2 className="text-3xl font-bold">
              Ready to Transform Your Research?
            </h2>
            <p className="text-lg opacity-90">
              Join researchers who are scaling their insights with AI-powered automation
            </p>
            <Link href="/auth/register">
              <Button size="lg" variant="secondary" className="gap-2">
                Start Free <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
