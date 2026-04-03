import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, Zap, Users, PieChart, Bot, ChevronRight } from 'lucide-react';

const Landing = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-50 bg-background/80">
        <div className="container flex items-center justify-between h-16">
          <Link to="/" className="font-display text-xl font-bold tracking-tight text-primary">
            Pay<span className="text-accent">Matrix</span>
          </Link>
          <Link to="/dashboard">
            <Button size="sm">
              Open App <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="container py-24 md:py-32 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary mb-8 animate-fade-in">
          <Zap className="h-3.5 w-3.5" /> AI-Powered Settlement Optimizer
        </div>
        <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight max-w-4xl mx-auto leading-[1.1] animate-fade-in" style={{ animationDelay: '0.1s', opacity: 0 }}>
          Split expenses.
          <br />
          <span className="text-primary">Settle smarter.</span>
        </h1>
        <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto animate-fade-in" style={{ animationDelay: '0.2s', opacity: 0 }}>
          PayMatrix minimizes the number of transactions in your group using graph optimization algorithms. Add expenses naturally, settle with fewer payments.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-10 animate-fade-in" style={{ animationDelay: '0.3s', opacity: 0 }}>
          <Link to="/dashboard">
            <Button size="lg" className="text-base px-8">
              Get Started <ChevronRight className="ml-1 h-5 w-5" />
            </Button>
          </Link>
          <Link to="/dashboard">
            <Button size="lg" variant="outline" className="text-base px-8">
              View Demo
            </Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="container pb-24">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { icon: Zap, title: 'Min Cash Flow', desc: 'Optimizes settlements to reduce the total number of transactions using graph algorithms.' },
            { icon: Users, title: 'Group Management', desc: 'Create groups, add members, and track expenses with equal, unequal, or percentage splits.' },
            { icon: PieChart, title: 'Visual Insights', desc: 'Category-wise spending charts and trend analysis to understand your group finances.' },
            { icon: Bot, title: 'NLP Input', desc: 'Type "Paid 500 for food" and PayMatrix auto-extracts amount, category, and details.' },
          ].map((f, i) => (
            <div
              key={f.title}
              className="group rounded-xl border bg-card p-6 hover:shadow-lg hover:border-primary/30 transition-all duration-300 animate-fade-in"
              style={{ animationDelay: `${0.4 + i * 0.1}s`, opacity: 0 }}
            >
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-display font-semibold text-lg mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container text-center text-sm text-muted-foreground">
          © 2026 PayMatrix — Smart Expense Settlement System
        </div>
      </footer>
    </div>
  );
};

export default Landing;
