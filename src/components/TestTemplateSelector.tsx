import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Database, 
  Zap, 
  TrendingUp, 
  Settings, 
  Info,
  Clock,
  HardDrive,
  Cpu,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { DEFAULT_TEMPLATES, FLOW_SPECIFIC_TEMPLATES, type FlowTestTemplate, type TemplateSize } from '@/types/test-templates';

interface TestTemplateSelectorProps {
  flowId: string;
  onSelect: (template: FlowTestTemplate) => void;
  onCustomize?: (template: FlowTestTemplate) => void;
}

const TestTemplateSelector: React.FC<TestTemplateSelectorProps> = ({ flowId, onSelect, onCustomize }) => {
  const [selectedSize, setSelectedSize] = useState<TemplateSize>('small');
  const [customParams, setCustomParams] = useState<Record<string, any>>({});
  const [showAdvanced, setShowAdvanced] = useState(false);

  const baseTemplate = DEFAULT_TEMPLATES[selectedSize];
  const flowSpecific = FLOW_SPECIFIC_TEMPLATES[flowId] || [];

  const createTemplate = (size: TemplateSize, name?: string, customizations?: any): FlowTestTemplate => {
    const base = DEFAULT_TEMPLATES[size];
    return {
      id: `${flowId}-${size}-${Date.now()}`,
      name: name || `${size.charAt(0).toUpperCase() + size.slice(1)} Dataset`,
      flowId,
      size,
      description: base.description || '',
      parameters: { ...base.parameters, ...customizations },
      estimatedDuration: base.estimatedDuration || 0,
      resourceUsage: base.resourceUsage || { storage: 'N/A', database: 'N/A' },
    };
  };

  const handleSelectTemplate = (size: TemplateSize, customizations?: any) => {
    const template = createTemplate(size, undefined, customizations);
    onSelect(template);
  };

  const getSizeIcon = (size: TemplateSize) => {
    switch (size) {
      case 'small': return <Database className="w-4 h-4" />;
      case 'medium': return <Zap className="w-4 h-4" />;
      case 'large': return <TrendingUp className="w-4 h-4" />;
      case 'custom': return <Settings className="w-4 h-4" />;
    }
  };

  const getSizeColor = (size: TemplateSize) => {
    switch (size) {
      case 'small': return 'bg-green-500/10 text-green-700 border-green-200';
      case 'medium': return 'bg-blue-500/10 text-blue-700 border-blue-200';
      case 'large': return 'bg-purple-500/10 text-purple-700 border-purple-200';
      case 'custom': return 'bg-orange-500/10 text-orange-700 border-orange-200';
    }
  };

  return (
    <div className="space-y-4">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Select Test Data Template</AlertTitle>
        <AlertDescription>
          Choose a predefined template or create a custom configuration for seeding test data.
        </AlertDescription>
      </Alert>

      <Tabs value={selectedSize} onValueChange={(v) => setSelectedSize(v as TemplateSize)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="small">Small</TabsTrigger>
          <TabsTrigger value="medium">Medium</TabsTrigger>
          <TabsTrigger value="large">Large</TabsTrigger>
          <TabsTrigger value="custom">Custom</TabsTrigger>
        </TabsList>

        {(['small', 'medium', 'large'] as TemplateSize[]).map((size) => (
          <TabsContent key={size} value={size} className="space-y-4">
            <Card className={`border-2 ${getSizeColor(size)}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    {getSizeIcon(size)}
                    {size.charAt(0).toUpperCase() + size.slice(1)} Dataset
                  </CardTitle>
                  <Badge variant="outline" className={getSizeColor(size)}>
                    {size.toUpperCase()}
                  </Badge>
                </div>
                <CardDescription>{DEFAULT_TEMPLATES[size].description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Resource Estimates */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Duration</p>
                      <p className="font-medium">{DEFAULT_TEMPLATES[size].estimatedDuration}s</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <HardDrive className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Storage</p>
                      <p className="font-medium">{DEFAULT_TEMPLATES[size].resourceUsage?.storage}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Cpu className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Records</p>
                      <p className="font-medium">{DEFAULT_TEMPLATES[size].resourceUsage?.database}</p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Parameters Preview */}
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">Configuration</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {Object.entries(DEFAULT_TEMPLATES[size].parameters || {}).map(([key, value]) => (
                      <div key={key} className="flex justify-between p-2 bg-muted/50 rounded">
                        <span className="text-muted-foreground">{key}:</span>
                        <span className="font-medium">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Button 
                  onClick={() => handleSelectTemplate(size)}
                  className="w-full"
                >
                  Use This Template
                </Button>
              </CardContent>
            </Card>

            {/* Flow-Specific Variations */}
            {flowSpecific.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Flow-Specific Variations</h3>
                <div className="grid gap-2">
                  {flowSpecific.map((variation, idx) => (
                    <Card key={idx} className="cursor-pointer hover:border-primary transition-colors">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">{variation.name}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex justify-between items-center text-xs text-muted-foreground mb-2">
                          <span>{Object.keys(variation.parameters || {}).length} custom parameters</span>
                        </div>
                        <Button 
                          size="sm"
                          variant="outline"
                          onClick={() => handleSelectTemplate(size, variation.parameters)}
                          className="w-full"
                        >
                          Use Variation
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        ))}

        {/* Custom Template */}
        <TabsContent value="custom" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Custom Configuration
              </CardTitle>
              <CardDescription>
                Fine-tune all parameters to create a custom test dataset
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-4">
                  {/* Organizations */}
                  <div className="space-y-2">
                    <Label>Organizations Count</Label>
                    <div className="flex items-center gap-4">
                      <Slider
                        value={[customParams.organizationCount || 1]}
                        onValueChange={([value]) => setCustomParams({ ...customParams, organizationCount: value })}
                        min={1}
                        max={20}
                        step={1}
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        value={customParams.organizationCount || 1}
                        onChange={(e) => setCustomParams({ ...customParams, organizationCount: parseInt(e.target.value) })}
                        className="w-20"
                      />
                    </div>
                  </div>

                  {/* Users */}
                  <div className="space-y-2">
                    <Label>Users Per Organization</Label>
                    <div className="flex items-center gap-4">
                      <Slider
                        value={[customParams.usersPerOrg || 5]}
                        onValueChange={([value]) => setCustomParams({ ...customParams, usersPerOrg: value })}
                        min={1}
                        max={50}
                        step={1}
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        value={customParams.usersPerOrg || 5}
                        onChange={(e) => setCustomParams({ ...customParams, usersPerOrg: parseInt(e.target.value) })}
                        className="w-20"
                      />
                    </div>
                  </div>

                  {/* Interviews */}
                  <div className="space-y-2">
                    <Label>Interviews Per Organization</Label>
                    <div className="flex items-center gap-4">
                      <Slider
                        value={[customParams.interviewsPerOrg || 5]}
                        onValueChange={([value]) => setCustomParams({ ...customParams, interviewsPerOrg: value })}
                        min={1}
                        max={30}
                        step={1}
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        value={customParams.interviewsPerOrg || 5}
                        onChange={(e) => setCustomParams({ ...customParams, interviewsPerOrg: parseInt(e.target.value) })}
                        className="w-20"
                      />
                    </div>
                  </div>

                  {/* Questions */}
                  <div className="space-y-2">
                    <Label>Questions Per Interview</Label>
                    <div className="flex items-center gap-4">
                      <Slider
                        value={[customParams.questionsPerInterview || 15]}
                        onValueChange={([value]) => setCustomParams({ ...customParams, questionsPerInterview: value })}
                        min={5}
                        max={50}
                        step={5}
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        value={customParams.questionsPerInterview || 15}
                        onChange={(e) => setCustomParams({ ...customParams, questionsPerInterview: parseInt(e.target.value) })}
                        className="w-20"
                      />
                    </div>
                  </div>

                  {/* Candidates */}
                  <div className="space-y-2">
                    <Label>Candidates Per Interview</Label>
                    <div className="flex items-center gap-4">
                      <Slider
                        value={[customParams.candidatesPerInterview || 10]}
                        onValueChange={([value]) => setCustomParams({ ...customParams, candidatesPerInterview: value })}
                        min={1}
                        max={50}
                        step={1}
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        value={customParams.candidatesPerInterview || 10}
                        onChange={(e) => setCustomParams({ ...customParams, candidatesPerInterview: parseInt(e.target.value) })}
                        className="w-20"
                      />
                    </div>
                  </div>

                  <Separator />

                  {/* Feature Toggles */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold">Features</h4>
                    
                    <div className="flex items-center justify-between">
                      <Label htmlFor="proctoring" className="cursor-pointer">Enable Proctoring</Label>
                      <Switch
                        id="proctoring"
                        checked={customParams.enableProctoring || false}
                        onCheckedChange={(checked) => setCustomParams({ ...customParams, enableProctoring: checked })}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="ai" className="cursor-pointer">Enable AI Features</Label>
                      <Switch
                        id="ai"
                        checked={customParams.enableAI || false}
                        onCheckedChange={(checked) => setCustomParams({ ...customParams, enableAI: checked })}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="violations" className="cursor-pointer">Include Violations</Label>
                      <Switch
                        id="violations"
                        checked={customParams.includeViolations || false}
                        onCheckedChange={(checked) => setCustomParams({ ...customParams, includeViolations: checked })}
                      />
                    </div>
                  </div>

                  {/* Advanced Options */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="w-full justify-between"
                  >
                    Advanced Options
                    {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>

                  {showAdvanced && (
                    <div className="space-y-3 pl-4 border-l-2 border-muted">
                      <div className="space-y-2">
                        <Label>Data Complexity</Label>
                        <select
                          className="w-full p-2 border rounded"
                          value={customParams.dataComplexity || 'moderate'}
                          onChange={(e) => setCustomParams({ ...customParams, dataComplexity: e.target.value })}
                        >
                          <option value="simple">Simple</option>
                          <option value="moderate">Moderate</option>
                          <option value="complex">Complex</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <Label>Attempts Per Candidate</Label>
                        <Input
                          type="number"
                          value={customParams.attemptsPerCandidate || 1}
                          onChange={(e) => setCustomParams({ ...customParams, attemptsPerCandidate: parseInt(e.target.value) })}
                          min={1}
                          max={5}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              <Button 
                onClick={() => handleSelectTemplate('custom', customParams)}
                className="w-full"
              >
                Use Custom Configuration
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TestTemplateSelector;
