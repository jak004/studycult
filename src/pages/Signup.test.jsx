import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Signup from './Signup'

const mockSignUp = vi.fn()

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ signUp: mockSignUp }),
}))

vi.mock('../components/GoogleButton', () => ({
  default: () => <div>Mock Google button</div>,
}))

function renderSignup() {
  return render(
    <MemoryRouter>
      <Signup />
    </MemoryRouter>
  )
}

async function fillRequiredFields(user, { password = 'CorrectHorse1!' } = {}) {
  await user.type(screen.getByPlaceholderText('Ama'), 'Test')
  await user.type(screen.getByPlaceholderText('Owusu'), 'User')
  await user.type(screen.getByPlaceholderText('you@example.com'), 'test@example.com')
  await user.type(screen.getByPlaceholderText('At least 8 characters'), password)
  await user.click(screen.getByRole('checkbox', { name: /i agree to the/i }))
}

beforeEach(() => {
  mockSignUp.mockReset()
})

describe('Signup', () => {
  it('keeps Create account disabled until the password is valid and terms are agreed to', async () => {
    const user = userEvent.setup()
    renderSignup()

    const submit = screen.getByRole('button', { name: /create account/i })
    expect(submit).toBeDisabled()

    await user.type(screen.getByPlaceholderText('Ama'), 'Test')
    await user.type(screen.getByPlaceholderText('Owusu'), 'User')
    await user.type(screen.getByPlaceholderText('you@example.com'), 'test@example.com')
    await user.type(screen.getByPlaceholderText('At least 8 characters'), 'weak')
    expect(submit).toBeDisabled()

    await user.clear(screen.getByPlaceholderText('At least 8 characters'))
    await user.type(screen.getByPlaceholderText('At least 8 characters'), 'CorrectHorse1!')
    expect(submit).toBeDisabled() // password valid, but terms not yet agreed to

    await user.click(screen.getByRole('checkbox', { name: /i agree to the/i }))
    expect(submit).toBeEnabled()
  })

  it('calls signUp with the entered details and selected role', async () => {
    mockSignUp.mockResolvedValue({ data: { session: { user: {} } }, error: null })
    const user = userEvent.setup()
    renderSignup()

    await user.click(screen.getByRole('button', { name: /i'm a tutor/i }))
    await fillRequiredFields(user)
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() =>
      expect(mockSignUp).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'test@example.com', firstName: 'Test', lastName: 'User', role: 'tutor' })
      )
    )
  })

  it('shows the confirmation message when signup succeeds without an immediate session', async () => {
    mockSignUp.mockResolvedValue({ data: { session: null }, error: null })
    const user = userEvent.setup()
    renderSignup()

    await fillRequiredFields(user)
    await user.click(screen.getByRole('button', { name: /create account/i }))

    expect(await screen.findByText(/we sent a confirmation link/i)).toBeInTheDocument()
  })

  it('shows the error message when signup fails', async () => {
    mockSignUp.mockResolvedValue({ data: null, error: { message: 'Email already registered' } })
    const user = userEvent.setup()
    renderSignup()

    await fillRequiredFields(user)
    await user.click(screen.getByRole('button', { name: /create account/i }))

    expect(await screen.findByText('Email already registered')).toBeInTheDocument()
  })
})
