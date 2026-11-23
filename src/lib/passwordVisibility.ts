export function getPasswordInputType(showPassword: boolean): 'text' | 'password' {
  return showPassword ? 'text' : 'password'
}
