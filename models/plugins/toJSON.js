// Plugin para convertir documentos de Mongoose a JSON
// Elimina __v, convierte _id a id, y respeta campos marcados como private: true
const toJSON = (schema) => {
  let transform;

  if (schema.options.toJSON && schema.options.toJSON.transform) {
    transform = schema.options.toJSON.transform;
  }

  schema.options.toJSON = {
    ...schema.options.toJSON,
    transform(doc, ret, options) {
      // Remove __v
      delete ret.__v;

      // Convert _id to id
      ret.id = ret._id.toString();
      delete ret._id;

      // Remove private fields
      Object.keys(schema.paths).forEach((path) => {
        if (schema.paths[path].options && schema.paths[path].options.private) {
          delete ret[path];
        }
      });

      if (transform) {
        return transform(doc, ret, options);
      }
    },
  };
};

export default toJSON;
