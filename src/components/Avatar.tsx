type AvatarProps = {
  src?: string | null
  name: string
  size?: 'md' | 'lg'
}

export function ProfileAvatar({ src, name, size = 'md' }: AvatarProps) {
  const initial = name.trim().charAt(0).toUpperCase() || 'L'
  return (
    <span className={`avatar avatar--${size}`}>
      {src ? <img src={src} alt="" /> : <span className="avatar__initial">{initial}</span>}
    </span>
  )
}
