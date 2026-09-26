import { NavLink } from 'react-router-dom'

export default function Nav({ isAdmin }) {
  const items = [
    { to: '/', label: 'Find a ride' },
    { to: '/seats', label: 'My seats' },
    { to: '/drive', label: 'Drive' },
    { to: '/profile', label: 'Profile' }
  ]
  if (isAdmin) items.push({ to: '/admin', label: 'Admin' })
  return (
    <nav className="tabbar" aria-label="Main">
      {items.map((i) => (
        <NavLink key={i.to} to={i.to} end className={({ isActive }) => (isActive ? 'tab on' : 'tab')}>
          {i.label}
        </NavLink>
      ))}
    </nav>
  )
}
