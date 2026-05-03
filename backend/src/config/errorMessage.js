const errMsg = (err) => {
  if (!err) return 'Erreur inconnue';
  if (typeof err === 'string') return err;
  if (typeof err.message === 'string' && err.message) return err.message;
  if (typeof err.error === 'string') return err.error;
  if (typeof err.error?.message === 'string') return err.error.message;
  if (typeof err.detail === 'string') return err.detail;
  return JSON.stringify(err).substring(0, 200);
};
module.exports = errMsg;
