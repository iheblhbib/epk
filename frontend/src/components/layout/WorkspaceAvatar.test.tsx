import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { WorkspaceAvatar } from '@/components/layout/WorkspaceAvatar'

describe('WorkspaceAvatar', () => {
  it('renders an image when logoUrl is set', () => {
    render(<WorkspaceAvatar id={1} name="Acme Records" logoUrl="https://example.com/logo.png" />)

    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('src', 'https://example.com/logo.png')
  })

  it('renders the uppercased first letter when logoUrl is null', () => {
    render(<WorkspaceAvatar id={1} name="acme records" logoUrl={null} />)

    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('gives the same id the same background color across renders', () => {
    const { container: first } = render(<WorkspaceAvatar id={3} name="Acme" logoUrl={null} />)
    const { container: second } = render(<WorkspaceAvatar id={3} name="Different Name" logoUrl={null} />)

    const firstColor = (first.querySelector('span') as HTMLElement).style.backgroundColor
    const secondColor = (second.querySelector('span') as HTMLElement).style.backgroundColor
    expect(firstColor).toBe(secondColor)
  })
})
