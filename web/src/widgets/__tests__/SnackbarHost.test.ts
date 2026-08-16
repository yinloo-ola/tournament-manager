import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import SnackbarHost from '../SnackbarHost.vue'
import { useToast } from '@/shared/ui/toast'

const { queue, dismiss, toast } = useToast()

beforeEach(() => {
  queue.value.forEach((t) => dismiss(t.id))
  vi.clearAllTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('SnackbarHost action button', () => {
  it('should run the action handler and dismiss when the action is clicked', async () => {
    vi.useFakeTimers()
    const onAction = vi.fn()
    toast.error('Missing sheet', {
      actionLabel: 'Download template',
      onAction,
      duration: 0
    })
    const wrapper = mount(SnackbarHost)
    await vi.advanceTimersByTimeAsync(0)

    const button = wrapper.find('button')
    expect(button.text()).toBe('Download template')
    await button.trigger('click')

    expect(onAction).toHaveBeenCalledTimes(1)
    expect(queue.value).toHaveLength(0)
    expect(wrapper.text()).not.toContain('Missing sheet')
  })

  it('should advance the queue to the next toast after the action dismisses', async () => {
    vi.useFakeTimers()
    const first = vi.fn()
    toast.error('First', { actionLabel: 'Download template', onAction: first, duration: 0 })
    toast.error('Second', { duration: 0 })
    const wrapper = mount(SnackbarHost)
    await vi.advanceTimersByTimeAsync(0)

    expect(wrapper.text()).toContain('First')
    await wrapper.find('button').trigger('click')

    expect(first).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('Second')
  })

  it('should still render the dismiss icon for toasts without an action', async () => {
    vi.useFakeTimers()
    toast.error('Plain error', { duration: 0 })
    const wrapper = mount(SnackbarHost)
    await vi.advanceTimersByTimeAsync(0)

    const button = wrapper.find('button')
    expect(button.attributes('aria-label')).toBe('Dismiss')
    await button.trigger('click')
    expect(queue.value).toHaveLength(0)
  })
})
