export default function BrowserArticleView({ html }: { html: string }) {
  return (
    <div
      className="max-w-3xl mx-auto px-8 py-6
        [&_img]:max-w-full [&_img]:rounded-lg [&_img]:my-3
        [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:text-gray-900 [&_h1]:mt-6 [&_h1]:mb-3
        [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-gray-900 [&_h2]:mt-5 [&_h2]:mb-2
        [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-gray-800 [&_h3]:mt-4 [&_h3]:mb-1
        [&_p]:text-[15px] [&_p]:text-gray-700 [&_p]:leading-relaxed [&_p]:mb-3
        [&_a]:text-indigo-600 [&_a]:underline
        [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3
        [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3
        [&_li]:text-[15px] [&_li]:text-gray-700 [&_li]:mb-1
        [&_blockquote]:border-l-4 [&_blockquote]:border-gray-200 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-gray-500
        [&_pre]:bg-gray-50 [&_pre]:rounded [&_pre]:p-3 [&_pre]:overflow-x-auto [&_pre]:text-xs
        [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:rounded [&_code]:text-xs"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
