import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, ArrowRight } from "lucide-react";

interface PlaceholderProps {
  title: string;
  description?: string;
}

const Placeholder = ({ title, description }: PlaceholderProps) => (
  <div className="container mx-auto p-6">
    <Card className="max-w-2xl mx-auto text-center">
      <CardHeader>
        <CardTitle className="flex items-center justify-center gap-2 text-2xl">
          <Clock className="h-6 w-6 text-gray-500" />
          Coming Soon
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          {title}
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          {description || `The ${title} feature is currently under development and will be available soon.`}
        </p>
        <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mt-6">
          <span>Return to</span>
          <a href="/" className="flex items-center gap-1 text-blue-600 hover:text-blue-800">
            Dashboard
            <ArrowRight className="h-3 w-3" />
          </a>
        </div>
      </CardContent>
    </Card>
  </div>
);

export default Placeholder;