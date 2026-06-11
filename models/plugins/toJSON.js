// Plugin para convertir documentos de Mongoose a JSON
export default function toJSON() {
  const { transform, __v, _id, ...object } = this.toObject();
  object.id = _id;
  return object;
}