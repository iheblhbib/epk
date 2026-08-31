import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Bold, Heading2, Heading3, Italic, Link as LinkIcon, List, ListOrdered, Quote } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Toggle } from '@/components/ui/toggle'
import { cn } from '@/lib/utils'

/**
 * The toolbar (and the StarterKit config below) only offers exactly what
 * config/purifier.php's "epk_richtext" profile allows server-side — headings
 * (h2-h4), bold, italic, links, lists, quotes. Anything else typed or pasted
 * in still gets stripped on save regardless, but there's no point offering a
 * button for formatting the backend will just discard.
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (html: string) => void
  placeholder?: string
}) {
  const { t } = useTranslation()
  const editor = useEditor({
    extensions: [
      // Tiptap v3's StarterKit bundles Link itself — configuring it here
      // (rather than also adding the standalone @tiptap/extension-link
      // package as a second extension) avoids registering two extensions
      // both named "link".
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        codeBlock: false,
        code: false,
        strike: false,
        horizontalRule: false,
        link: { openOnClick: false, autolink: true },
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class:
          'prose prose-sm max-w-none min-h-32 rounded-b-lg border border-t-0 border-input bg-transparent px-3 py-2 text-sm focus:outline-none [&_p]:my-1 [&_h2]:font-heading [&_h3]:font-heading [&_h4]:font-heading',
      },
    },
  })

  if (!editor) return null

  return (
    <div>
      <div className="flex flex-wrap items-center gap-0.5 rounded-t-lg border border-input bg-muted/40 p-1">
        <Toggle
          size="sm"
          pressed={editor.isActive('heading', { level: 2 })}
          onPressedChange={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          aria-label={t('epkBuilder.richText.heading2')}
        >
          <Heading2 className="size-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive('heading', { level: 3 })}
          onPressedChange={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          aria-label={t('epkBuilder.richText.heading3')}
        >
          <Heading3 className="size-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive('bold')}
          onPressedChange={() => editor.chain().focus().toggleBold().run()}
          aria-label={t('epkBuilder.richText.bold')}
        >
          <Bold className="size-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive('italic')}
          onPressedChange={() => editor.chain().focus().toggleItalic().run()}
          aria-label={t('epkBuilder.richText.italic')}
        >
          <Italic className="size-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive('bulletList')}
          onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
          aria-label={t('epkBuilder.richText.bulletList')}
        >
          <List className="size-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive('orderedList')}
          onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}
          aria-label={t('epkBuilder.richText.numberedList')}
        >
          <ListOrdered className="size-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive('blockquote')}
          onPressedChange={() => editor.chain().focus().toggleBlockquote().run()}
          aria-label={t('epkBuilder.richText.quote')}
        >
          <Quote className="size-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive('link')}
          onPressedChange={() => {
            if (editor.isActive('link')) {
              editor.chain().focus().unsetLink().run()
              return
            }
            const url = window.prompt(t('epkBuilder.richText.linkUrlPrompt'))
            if (url) editor.chain().focus().setLink({ href: url }).run()
          }}
          aria-label={t('epkBuilder.richText.link')}
        >
          <LinkIcon className="size-4" />
        </Toggle>
      </div>
      <div className={cn(!value && 'relative')}>
        <EditorContent editor={editor} />
        {editor.isEmpty && placeholder && (
          <p className="pointer-events-none absolute start-3 top-2 text-sm text-muted-foreground">
            {placeholder}
          </p>
        )}
      </div>
    </div>
  )
}
