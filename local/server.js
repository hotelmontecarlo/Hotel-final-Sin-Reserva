const app = require('../api/index');
const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log('Servidor corriendo en puerto', port);
});
