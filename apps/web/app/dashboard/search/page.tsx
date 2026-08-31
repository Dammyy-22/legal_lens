import { Search } from 'lucide-react'
import { ComingSoonPage } from '@/components/ComingSoonPage'

export default function SearchPage() {
  return (
    <ComingSoonPage
      Icon={Search}
      title="Search the law"
      description="Search will let you look up Nigerian legislation, regulations, and sections directly. It needs the same verified source corpus as the AI assistant, so it isn't available yet."
      detail="Backend: legal source registry + full-text/semantic index (not started)"
    />
  )
}
