export default function Footer({ dark = false }) {
  return (
    <footer className={`py-4 px-6 text-center text-xs ${dark ? 'text-slate-400' : 'text-gray-400'}`}>
      <p>© 2026 Al Naqbi &amp; Partners. All rights reserved.</p>
      <p className="mt-0.5">Developed by Syed Faisal Naseem</p>
    </footer>
  )
}
