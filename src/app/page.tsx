import Editor from '@/components/CodeMirror'

export default function Home() {
  return (
    <main className='h-screen w-screen flex flex-col overflow-hidden fixed inset-0'>
      {/* Fixed Header - prevent touch scrolling */}
      <div
        className='h-[100px] bg-white border-b border-gray-200 flex-shrink-0 z-10 touch-none'
        style={{ overscrollBehavior: 'none' }}
      >
        <div className='h-full flex items-center px-6'>
          <h1 className='text-xl font-semibold'>Editor Header</h1>
        </div>
      </div>

      {/* Editor Container - Takes remaining height */}
      <div className='flex-1 overflow-hidden relative'>
        <Editor />
      </div>
    </main>
  )
}
