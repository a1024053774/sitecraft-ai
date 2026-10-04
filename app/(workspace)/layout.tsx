export default function WorkspaceLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <link rel="stylesheet" href="/workspace.css" />
      {children}
    </>
  );
}
