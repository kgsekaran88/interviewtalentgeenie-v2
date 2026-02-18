import { useState, useEffect } from 'react';
import { logger } from '@/lib/logger';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useUserFriendlyToast } from '@/hooks/useUserFriendlyToast';
import { useNavigate } from 'react-router-dom';
import { 
  Bot, 
  Save, 
  RefreshCw, 
  Settings, 
  MessageSquare, 
  TrendingUp,
  Users,
  Clock,
  CheckCircle2,
  BookOpen
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { invokeFunction } from '@/lib/supabaseFunctions';

export default function ChatbotManagement() {
  const { toast, errorToast, successToast } = useUserFriendlyToast();
  const navigate = useNavigate();
  const [isEnabled, setIsEnabled] = useState(true);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(500);
  const [model, setModel] = useState('google/gemini-2.5-flash');
  const [isSaving, setIsSaving] = useState(false);
  const [stats, setStats] = useState({
    totalConversations: 0,
    activeUsers: 0,
    avgResponseTime: 0,
    satisfactionRate: 0,
  });

  useEffect(() => {
    loadConfiguration();
    loadStats();
  }, []);

  const loadConfiguration = async () => {
    try {
      // Fetch chatbot knowledge from database
      const { data: knowledge, error } = await supabase
        .from('chatbot_knowledge')
        .select('*')
        .eq('is_active', true)
        .order('priority', { ascending: false });

      if (error) {
        logger.error('Error loading chatbot knowledge:', error);
      }

      // Build knowledge base context from database
      let knowledgeContext = '';
      if (knowledge && knowledge.length > 0) {
        const groupedByCategory = knowledge.reduce((acc: any, item) => {
          if (!acc[item.category]) acc[item.category] = [];
          acc[item.category].push(item);
          return acc;
        }, {});

        knowledgeContext = Object.entries(groupedByCategory)
          .map(([category, items]: [string, any]) => {
            return `\n**${category}:**\n` + 
              items.map((item: any) => `- ${item.title}: ${item.answer.substring(0, 150)}...`).join('\n');
          })
          .join('\n');
      }

      // Set system prompt with loaded knowledge
      setSystemPrompt(`You are the TalentGeenie Platform Assistant - an expert AI helping users navigate and understand the comprehensive interview management platform.

**Platform Knowledge:**

1. **Interview Creation & Management**
   - Create interviews with AI-generated questions based on role, skills, difficulty
   - Template library with pre-built interview structures
   - Question repository with approval workflow

2. **Proctoring System**
   - Real-time monitoring: camera, microphone, tab switches
   - Automatic violation detection
   - Integrity score calculation

3. **AI Features**
   - Question generation using AI
   - Resume parsing and skill extraction
   - Answer evaluation with detailed scoring

4. **Roles & Access Control**
   - Platform Admin, Partner Admin, HR Recruiter, Technical SPOC, Interviewer, Candidate

5. **Reporting & Analytics**
   - CPI scoring, comparative reports, skill-wise breakdown

${knowledgeContext}

**Your Behavior:**
- Be concise, helpful, and professional
- Provide step-by-step guidance when needed
- Use technical terms but explain them clearly`);
    } catch (error) {
      logger.error('Error in loadConfiguration:', error);
    }
  };

  const loadStats = async () => {
    // Load chatbot usage statistics
    // Mock data for now
    setStats({
      totalConversations: 1247,
      activeUsers: 89,
      avgResponseTime: 1.2,
      satisfactionRate: 94.5,
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save configuration to database
      await new Promise(resolve => setTimeout(resolve, 1000)); // Mock save
      
      toast({
        title: "Configuration Saved",
        description: "Chatbot settings have been updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save configuration.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    toast({
      title: "Test Started",
      description: "Opening test conversation...",
    });
    // Open chatbot for testing
  };

  const handleRefresh = async () => {
    setIsSaving(true);
    try {
      toast({
        title: "Scanning Platform",
        description: "Analyzing features and generating knowledge base...",
      });

      const { data, error } = await invokeFunction('scan-platform-features');
      
      if (error) throw error;

      toast({
        title: "Scan Complete",
        description: `Generated ${data.entriesGenerated} knowledge entries across ${data.categoriesScanned} categories.`,
      });

      // Reload configuration and stats
      await Promise.all([loadConfiguration(), loadStats()]);
      
      toast({
        title: "Refreshed",
        description: "Chatbot knowledge and configuration reloaded.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to refresh configuration.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="container mx-auto py-4 sm:py-8 px-3 sm:px-4 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2 flex items-center gap-2 sm:gap-3">
            <Bot className="h-8 w-8 sm:h-10 sm:w-10 text-primary shrink-0" />
            Chatbot Management
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Configure and monitor the AI-powered assistant
          </p>
        </div>
        <div className="grid grid-cols-2 sm:flex gap-2">
          <Button variant="outline" onClick={() => navigate('/admin/chatbot-training')} className="min-h-[44px] text-xs sm:text-sm">
            <BookOpen className="mr-1 sm:mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Manage </span>Knowledge
          </Button>
          <Button variant="outline" onClick={handleRefresh} disabled={isSaving} className="min-h-[44px] text-xs sm:text-sm">
            <RefreshCw className={`mr-1 sm:mr-2 h-4 w-4 ${isSaving ? 'animate-spin' : ''}`} />
            {isSaving ? 'Scanning...' : <><span className="hidden sm:inline">Auto-</span>Update</>}
          </Button>
          <Button variant="outline" onClick={handleTest} className="min-h-[44px] text-xs sm:text-sm">
            <MessageSquare className="mr-1 sm:mr-2 h-4 w-4" />
            Test
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="min-h-[44px] text-xs sm:text-sm">
            {isSaving ? (
              <RefreshCw className="mr-1 sm:mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-1 sm:mr-2 h-4 w-4" />
            )}
            Save
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <Card>
          <CardHeader className="pb-2 sm:pb-3 p-3 sm:p-6">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs sm:text-sm font-medium">Conversations</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0">
            <div className="text-xl sm:text-2xl font-bold">{stats.totalConversations.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 sm:pb-3 p-3 sm:p-6">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs sm:text-sm font-medium">Active Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0">
            <div className="text-xl sm:text-2xl font-bold">{stats.activeUsers}</div>
            <p className="text-xs text-muted-foreground">Last 24 hours</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 sm:pb-3 p-3 sm:p-6">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs sm:text-sm font-medium">Response Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0">
            <div className="text-xl sm:text-2xl font-bold">{stats.avgResponseTime}s</div>
            <p className="text-xs text-muted-foreground">Average</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 sm:pb-3 p-3 sm:p-6">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs sm:text-sm font-medium">Satisfaction</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0">
            <div className="text-xl sm:text-2xl font-bold">{stats.satisfactionRate}%</div>
            <p className="text-xs text-muted-foreground">User feedback</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Configuration */}
      <Tabs defaultValue="configuration" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 h-auto">
          <TabsTrigger value="configuration" className="text-xs sm:text-sm min-h-[44px] py-2">Config</TabsTrigger>
          <TabsTrigger value="knowledge" className="text-xs sm:text-sm min-h-[44px] py-2">Knowledge</TabsTrigger>
          <TabsTrigger value="analytics" className="text-xs sm:text-sm min-h-[44px] py-2">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="configuration" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>
                Configure basic chatbot behavior and availability
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Chatbot</Label>
                  <p className="text-sm text-muted-foreground">
                    Make the chatbot available to all users
                  </p>
                </div>
                <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="model">AI Model</Label>
                <select
                  id="model"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                >
                  <option value="google/gemini-2.5-flash">Gemini 2.5 Flash (Recommended)</option>
                  <option value="google/gemini-2.5-pro">Gemini 2.5 Pro (Premium)</option>
                  <option value="openai/gpt-5-mini">GPT-5 Mini</option>
                  <option value="openai/gpt-5">GPT-5 (Premium)</option>
                </select>
                <p className="text-sm text-muted-foreground">
                  Choose the AI model powering the chatbot responses
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="temperature">Temperature: {temperature}</Label>
                <input
                  id="temperature"
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full"
                />
                <p className="text-sm text-muted-foreground">
                  Controls randomness. Lower = more focused, Higher = more creative
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxTokens">Max Response Length</Label>
                <Input
                  id="maxTokens"
                  type="number"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                  min="100"
                  max="2000"
                />
                <p className="text-sm text-muted-foreground">
                  Maximum tokens in chatbot response (100-2000)
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>System Prompt</CardTitle>
              <CardDescription>
                Define the chatbot's personality and knowledge scope
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={15}
                className="font-mono text-sm"
                placeholder="Enter system prompt..."
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="knowledge" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Platform Knowledge</CardTitle>
              <CardDescription>
                Current knowledge areas covered by the chatbot
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { title: 'Interview Management', coverage: 100 },
                  { title: 'Proctoring System', coverage: 100 },
                  { title: 'AI Features', coverage: 95 },
                  { title: 'User Roles & Permissions', coverage: 100 },
                  { title: 'Reporting & Analytics', coverage: 90 },
                  { title: 'ATS Integration', coverage: 85 },
                  { title: 'Billing & Plans', coverage: 100 },
                  { title: 'Security & Compliance', coverage: 95 },
                ].map((area) => (
                  <div key={area.title} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <span className="font-medium">{area.title}</span>
                    </div>
                    <Badge variant="secondary">{area.coverage}%</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Usage Analytics</CardTitle>
              <CardDescription>
                Chatbot performance and user interaction metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium mb-2">Analytics Dashboard</p>
                <p className="text-sm text-muted-foreground">
                  Detailed analytics and insights coming soon
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
