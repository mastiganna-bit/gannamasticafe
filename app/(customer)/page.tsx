import HeroSection from '@/components/home/HeroSection'
import FeaturedSection from '@/components/home/FeaturedSection'
import WhyUsSection from '@/components/home/WhyUsSection'
import StorySection from '@/components/home/StorySection'
import { createClient } from '@/lib/supabase/server'

export default async function HomePage() {
  const supabase = await createClient()

  // Fetch featured items (first item from each category)
  const { data: featured } = await supabase
    .from('menu_items')
    .select('*, menu_item_sizes(*)')
    .eq('is_available', true)
    .in('id', [
      '11111111-1111-1111-1111-111111111001', // Ganna Juice
      '11111111-1111-1111-1111-111111111025', // Deluxe Burger
      '11111111-1111-1111-1111-111111111049', // Gannamasti Spl Pizza
    ])

  return (
    <>
      <HeroSection />
      <FeaturedSection items={featured || []} />
      <WhyUsSection />
      <StorySection />
    </>
  )
}
