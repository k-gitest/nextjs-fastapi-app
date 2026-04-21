import { http, HttpResponse } from 'msw'
import type { User } from '@/features/auth/types/'

export const mockUser: User = {
  id: "clx1234",
  email: 'test@example.com',
  first_name: 'Test',
  last_name: 'User',
}

export const mockAuthResponse = {
  access: 'access-token',
  refresh: 'refresh-token',
  user: mockUser,
}

export const authHandlers = [
  http.get(`**/auth/user/`, () =>
    HttpResponse.json(mockUser, { status: 200 })
  ),

  http.post(`**/auth/login/`, () =>
    HttpResponse.json(mockAuthResponse, { status: 200 })
  ),

  http.post(`**/auth/registration/`, () =>
    HttpResponse.json(mockAuthResponse, { status: 201 })
  ),

  http.post(`**/auth/token/refresh/`, () =>
    HttpResponse.json({ access: 'new-access-token' }, { status: 200 })
  ),

  http.post(`**/auth/logout/`, () =>
    new HttpResponse(null, { status: 204 })
  ),
]