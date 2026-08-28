import { HttpResponse, http } from 'msw'

const API_URL = 'http://localhost:8000'

export const handlers = [
  http.get(`${API_URL}/sanctum/csrf-cookie`, () => new HttpResponse(null, { status: 204 })),
  http.get(`${API_URL}/api/user`, () => HttpResponse.json({ message: 'Unauthenticated.' }, { status: 401 })),
]
