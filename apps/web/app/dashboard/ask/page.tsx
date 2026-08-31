import { MessageCircleQuestion } from 'lucide-react'
import { ComingSoonPage } from '@/components/ComingSoonPage'

export default function AskPage() {
  return (
    <ComingSoonPage
      Icon={MessageCircleQuestion}
      title="Ask a question"
      description="The AI legal assistant isn't live yet — it depends on a verified corpus of Nigerian legal sources and a citation-checked answer pipeline, neither of which exist yet. We won't turn this on until every answer can be traced to a real source."
      detail="Backend: source ingestion → retrieval → citation validation (not started)"
    />
  )
}
