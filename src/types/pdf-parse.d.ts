// Ambient declaration for the inner pdf-parse module path. We import
// pdf-parse/lib/pdf-parse.js directly to avoid the package's index.js
// debug code, which reads a bundled test PDF at module load and crashes
// Next.js page-data collection. @types/pdf-parse only declares the
// top-level module, so we proxy the same types onto the inner path.
declare module 'pdf-parse/lib/pdf-parse.js' {
  import pdfParse from 'pdf-parse'
  export default pdfParse
}
