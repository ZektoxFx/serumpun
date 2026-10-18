/**
 * Help & policies (Me, and the Terms link on the sign-up form): readable signed out too, so nothing here checks the
 * session. The phone-width column of the resident pages, without their bottom bar.
 */
export default function HelpLayout({ children }: LayoutProps<'/help'>) {
  return <div className="mx-auto w-full max-w-md pb-10">{children}</div>;
}
