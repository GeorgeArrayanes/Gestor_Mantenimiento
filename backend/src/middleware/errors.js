import multer from 'multer';

export function notFound(req, res) {
  res.status(404).json({ message: 'Recurso no encontrado.' });
}

export function errorHandler(error, req, res, _next) {
  if (error instanceof multer.MulterError) {
    const message = error.code === 'LIMIT_FILE_SIZE' ? 'El archivo supera el tamaño máximo permitido.' : 'No se pudo procesar el archivo.';
    return res.status(400).json({ message });
  }
  if (error?.code === '23505') return res.status(409).json({ message: 'Ya existe un registro con ese dato único.' });
  if (['23503','23514','22P02'].includes(error?.code)) return res.status(400).json({ message: 'Los datos no son válidos o hacen referencia a un registro inexistente.' });
  if (error?.type === 'entity.parse.failed') return res.status(400).json({ message: 'El contenido de la solicitud no es válido.' });
  const status = error.status || 500;
  if (status >= 500) console.error(error);
  res.status(status).json({ message: status >= 500 ? 'Ocurrió un error inesperado. Intenta nuevamente.' : error.message });
}
