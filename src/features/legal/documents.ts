export type LegalDocumentName = 'tos' | 'privacy' | 'courier_contract' | 'pilot_terms';

export interface LegalSection {
  readonly id: string;
  readonly title: string;
  readonly paragraphs?: readonly string[];
  readonly bullets?: readonly string[];
}

export interface LegalDocumentDescriptor {
  readonly document: LegalDocumentName;
  readonly href: string;
  readonly title: string;
  readonly shortTitle: string;
  readonly version: string;
  readonly effectiveDate: string;
  readonly updatedLabel: string;
  readonly intro: string;
  readonly sections: readonly LegalSection[];
}

const UPDATED_LABEL = '25 de septiembre de 2026';

const LEGAL_DOCUMENTS: Readonly<Record<LegalDocumentName, LegalDocumentDescriptor>> = {
  tos: {
    document: 'tos',
    href: '/legal/terms',
    title: 'Términos y Condiciones de uso',
    shortTitle: 'Términos y Condiciones',
    version: '1.0',
    effectiveDate: '2026-09-25',
    updatedLabel: UPDATED_LABEL,
    intro:
      'Estos Términos regulan el uso de cadeApp en Aguilares, Tucumán. La plataforma facilita el contacto y la coordinación entre comercios o emprendimientos y repartidores.',
    sections: [
      {
        id: 'alcance',
        title: '1. Alcance y aceptación',
        paragraphs: [
          'Al crear una cuenta o aceptar una versión de estos Términos, la persona usuaria manifiesta haber tenido acceso al texto identificado por su versión. La aceptación queda asociada a la cuenta, al documento, a la versión y a la fecha y hora.',
          'La simple navegación no se considera aceptación. Cuando resulten aplicables normas imperativas, incluidas las de defensa del consumidor, esas normas prevalecen sobre cualquier cláusula incompatible.',
        ],
      },
      {
        id: 'intermediacion',
        title: '2. Función de cadeApp',
        paragraphs: [
          'cadeApp es una herramienta tecnológica de intermediación. Permite que un comercio publique una necesidad de entrega, que repartidores habilitados formulen ofertas y que el comercio seleccione una de ellas.',
          'cadeApp no cobra ni custodia el importe del flete, no recibe el dinero que corresponde al repartidor y no compra ni vende la mercadería transportada. Un eventual abono por usar la plataforma es distinto del precio de cada entrega.',
        ],
      },
      {
        id: 'ofertas',
        title: '3. Solicitudes y ofertas',
        bullets: [
          'Los comercios deben cargar información veraz y suficiente para coordinar la entrega.',
          'Los repartidores deciden si están disponibles, qué solicitudes les interesan y qué importe ofrecen, respetando el piso operativo vigente de la plataforma.',
          'La selección de una oferta corresponde al comercio. Hasta ese momento no existe asignación de viaje al repartidor.',
          'Las solicitudes y ofertas pueden vencer, cancelarse o republicarse conforme los estados que muestra la aplicación.',
        ],
      },
      {
        id: 'pago',
        title: '4. Pago del envío',
        paragraphs: [
          'El importe del flete aceptado lo paga quien recibe el pedido directamente al repartidor al momento de la entrega, según el medio informado o coordinado. El comercio cobra su producto por su cuenta.',
          'cadeApp no procesa, garantiza ni custodia ese pago. Esto no limita las obligaciones propias que la ley pueda imponer a cadeApp por el servicio tecnológico que efectivamente presta.',
        ],
      },
      {
        id: 'privacidad-entrega',
        title: '5. Datos de la entrega',
        paragraphs: [
          'Antes de aceptar una oferta, el repartidor ve sólo información operativa aproximada: barrios, distancia aproximada, tipo de paquete y medio de pago. No recibe nombre, teléfono, dirección ni coordenadas exactas del destinatario.',
          'Una vez seleccionada la oferta, los datos necesarios se habilitan al repartidor asignado exclusivamente para coordinar y completar esa entrega.',
        ],
      },
      {
        id: 'uso',
        title: '6. Uso responsable',
        bullets: [
          'No se permite cargar información falsa, suplantar identidades ni usar datos de terceros para fines ajenos a una entrega.',
          'No se permite eludir controles de autorización, acceder a información de otro rol ni interferir con la seguridad de la plataforma.',
          'Los incidentes y cancelaciones deben reportarse por los mecanismos disponibles en la aplicación.',
        ],
      },
      {
        id: 'disponibilidad',
        title: '7. Disponibilidad y servicios externos',
        paragraphs: [
          'Pueden existir interrupciones, mantenimiento, fallas de conectividad o indisponibilidad de proveedores externos. Las notificaciones push son un apoyo de mejor esfuerzo y nunca la única forma de conocer un cambio de estado.',
          'Los mapas y recorridos son ayudas orientativas. cadeApp no realiza seguimiento GPS en vivo del repartidor.',
        ],
      },
      {
        id: 'responsabilidad',
        title: '8. Responsabilidades',
        paragraphs: [
          'Cada participante responde por la información y las acciones que realiza dentro de su rol. El comercio conserva la responsabilidad sobre su producto y los datos que carga; el repartidor, sobre la ejecución material del traslado que acepta y las normas aplicables a su actividad.',
          'Nada de estos Términos excluye o limita responsabilidades, garantías o derechos que por ley sean irrenunciables.',
        ],
      },
      {
        id: 'versiones',
        title: '9. Versiones y cambios',
        paragraphs: [
          'Cada modificación se publica con una versión identificable. Una versión nueva no borra ni modifica el registro histórico de una aceptación anterior.',
          'Cuando un cambio material requiera nueva aceptación, la plataforma solicitará aceptar esa nueva versión antes de continuar con la función alcanzada.',
        ],
      },
      {
        id: 'ley',
        title: '10. Ley aplicable y contacto',
        paragraphs: [
          'Estos Términos se interpretan conforme la legislación de la República Argentina. Cuando correspondan normas de orden público o protección de consumidores, se respetan los derechos y jurisdicciones previstos por ellas.',
          'El contacto operativo de cadeApp está a cargo de Lautaro Emanuel Jimenez, titular del proyecto, con domicilio en Santa Cruz s/n, Aguilares, Tucumán, Argentina. Canales de atención: WhatsApp +54 3865 575688 y correo electrónico lautarojimenez02@gmail.com.',
        ],
      },
    ],
  },
  privacy: {
    document: 'privacy',
    href: '/legal/privacy',
    title: 'Política de Privacidad',
    shortTitle: 'Política de Privacidad',
    version: '1.0',
    effectiveDate: '2026-09-25',
    updatedLabel: UPDATED_LABEL,
    intro:
      'Esta Política explica qué datos trata cadeApp, para qué los utiliza, el carácter obligatorio o facultativo de su provisión, con quién puede compartirlos y cómo ejercer los derechos previstos por la Ley 25.326 y su reglamentación.',
    sections: [
      {
        id: 'responsable',
        title: '1. Responsable y contacto',
        paragraphs: [
          'El responsable del tratamiento de los datos personales es Lautaro Emanuel Jimenez, titular del proyecto cadeApp, con domicilio en Santa Cruz s/n, Aguilares, Tucumán, Argentina.',
          'Para consultas, solicitudes operativas o el ejercicio de derechos sobre datos personales, los canales de contacto habilitados son WhatsApp +54 3865 575688 y el correo electrónico lautarojimenez02@gmail.com. Antes de entregar o modificar información personal se podrá verificar fehacientemente la identidad de quien formula el pedido.',
        ],
      },
      {
        id: 'datos',
        title: '2. Categorías de datos que tratamos',
        bullets: [
          'Cuenta y perfil: identificador de usuario, rol, nombre mostrado, email, teléfono y credenciales de acceso administradas por el proveedor de autenticación.',
          'Comercios: nombre del negocio, zona, dirección de retiro, referencias y coordenadas cuando se utiliza el mapa.',
          'Repartidores: DNI informado, imágenes de DNI, selfie, avatar, vehículo y patente; licencia y seguro cuando son cargados en el perfil.',
          'Entregas y solicitudes: barrios, direcciones, coordenadas cuando se usan, tipo de paquete, notas, estados, ofertas e incidentes reportados.',
          'Destinatarios que no son usuarios directos: nombre, teléfono, dirección, referencias, punto de entrega y medio de pago informado por el comercio.',
          'Datos técnicos indispensables: registros mínimos de auditoría, sesión, seguridad y notificaciones push cuando se habilitan.',
        ],
      },
      {
        id: 'obligatoriedad-consecuencias',
        title: '3. Carácter obligatorio o facultativo y consecuencias de la negativa o inexactitud',
        paragraphs: [
          'Conforme al artículo 6 de la Ley 25.326, se informa con precisión el carácter obligatorio o facultativo de los datos requeridos por la plataforma según sus esquemas operativos:',
          'Registro de cuenta: son obligatorios el correo electrónico, la contraseña (gestionada por el proveedor de autenticación), la selección de rol (comercio o repartidor) y la aceptación expresa con versión de los Términos y la Política de Privacidad. El nombre visible (displayName) y el teléfono de contacto son facultativos en esta etapa.',
          'Alta y perfil de comercio: son obligatorios el nombre del negocio (businessName), el teléfono de contacto comercial (phone), la dirección de retiro habitual (defaultPickupAddress) y la aceptación de los Términos del piloto con su versión. La selección del barrio de retiro habitual (defaultPickupZoneId), las coordenadas en mapa (latitud/longitud) y las referencias adicionales (notes) son facultativas.',
          'Onboarding de repartidor: son obligatorios el número de DNI, las fotografías del frente y dorso del DNI, la fotografía selfie, la imagen de perfil o avatar, la selección del tipo de vehículo (vehicleType: bici, moto o auto) y las aceptaciones de Términos, Privacidad y Condiciones de repartidores con sus versiones. La patente del vehículo es obligatoria únicamente cuando se declara moto o auto (condicional) y no se exige para bicicleta. La carga de licencia de conducir y póliza de seguro es facultativa dentro del perfil en la plataforma (sin perjuicio de las exigencias normativas vigentes para circular en la vía pública).',
          'Solicitudes de entrega: son obligatorios el barrio y la dirección de retiro (pickupZoneId, pickupAddress), el barrio y la dirección de entrega (dropoffZoneId, dropoffAddress), el nombre del destinatario (recipientName), el teléfono del destinatario (recipientPhone), la declaración de autorización del destinatario (recipientConsentDeclared), el tipo de paquete (packageType), el medio de pago (recipientPaymentMethod) y la indicación de si precisa cambio (needsChange). Las coordenadas geográficas exactas de retiro y entrega (latitud/longitud), las notas o indicaciones accesorias (notes) y el monto específico para cambio en efectivo (cashChangeAmount) son facultativos o condicionales a la necesidad de cambio declarada.',
          'Consecuencias de la negativa o inexactitud: la negativa a suministrar los datos de carácter obligatorio o condicional aplicables impide crear o activar la cuenta, validar el perfil, publicar solicitudes de envío, formular ofertas u operar en la plataforma. La inexactitud o falsedad comprobada facultará la suspensión cautelar de la cuenta. La no provisión de datos facultativos no impide el uso de las funciones principales, aunque puede requerir aclaraciones manuales o limitar funcionalidades accesorias.',
        ],
      },
      {
        id: 'finalidades',
        title: '4. Para qué usamos los datos',
        bullets: [
          'Crear y gestionar cuentas, validar roles y aplicar permisos de acceso.',
          'Permitir el alta y configuración de comercios y la revisión administrativa de postulaciones de repartidores.',
          'Publicar solicitudes, formular y evaluar ofertas, coordinar el retiro y completar las entregas.',
          'Aplicar la revelación progresiva de datos: reservar la información exacta únicamente para los actores autorizados según el estado del viaje.',
          'Atender incidentes, consultas operativas, auditoría de seguridad y cumplimiento de obligaciones legales exigibles.',
          'Enviar notificaciones operativas cuando la persona usuaria las habilite; dichas notificaciones nunca contienen datos personales de destinatarios.',
        ],
      },
      {
        id: 'consentimiento',
        title: '5. Bases legales del tratamiento',
        paragraphs: [
          'Los datos de las personas usuarias se recaban con su consentimiento libre, expreso e informado o resultan necesarios para la ejecución de la relación de intermediación tecnológica solicitada por ellas, conforme a los artículos 5 y 6 de la Ley 25.326.',
          'El consentimiento se registra de forma verificable vinculando la cuenta, el documento legal, la versión vigente exacta y la fecha y hora de aceptación. Una nueva versión de los términos no borra ni modifica el registro histórico de consentimientos previos.',
        ],
      },
      {
        id: 'destinatarios',
        title: '6. Datos de la persona destinataria',
        paragraphs: [
          'El comercio que crea una solicitud de envío ingresa los datos de contacto y entrega del destinatario. El comercio declara y garantiza haber informado previamente a dicha persona sobre el destino del envío y contar con una base jurídica válida conforme al artículo 11 de la Ley 25.326 para comunicar dichos datos a cadeApp y al repartidor seleccionado, incluido el consentimiento previo cuando la normativa así lo exija.',
          'cadeApp no recaba directamente el consentimiento del destinatario ni utiliza sus datos para finalidades publicitarias, prospección comercial ni cesión a terceros ajenos a la entrega. Los datos del destinatario permanecen estrictamente resguardados: no se muestran en el listado público de pedidos y sólo se revelan al comercio emisor, al repartidor asignado una vez aceptada la oferta y a administradores autorizados en caso de auditoría o resolución de incidentes.',
        ],
      },
      {
        id: 'documentos',
        title: '7. DNI, selfie y documentos del repartidor',
        paragraphs: [
          'Los documentos de identidad y la selfie se almacenan en un espacio privado con controles de acceso restrictivos. Su lectura administrativa requiere acceso autorizado y queda auditada.',
          'La política operativa de cadeApp prevé conservar DNI y selfie mientras el repartidor permanezca activo y eliminarlos definitivamente a los 30 días corridos de verificada una baja definitiva o el rechazo de la postulación. Esos archivos se mantienen fuera del esquema general de backup de la base de datos.',
        ],
      },
      {
        id: 'proveedores',
        title: '8. Proveedores y transferencias internacionales',
        paragraphs: [
          'cadeApp utiliza proveedores tecnológicos para autenticación, base de datos, almacenamiento, hosting y notificaciones (incluyendo Supabase y Vercel), en la medida necesaria para prestar dichas funciones.',
          'En caso de que la infraestructura de dichos proveedores implique almacenamiento o procesamiento fuera de la República Argentina, las transferencias internacionales se sujetan al artículo 12 de la Ley 25.326, su reglamentación y las directivas de la Agencia de Acceso a la Información Pública (AAIP), garantizando estándares adecuados de protección.',
          'Ante requerimientos legítimos de autoridades competentes (incluyendo ARCA conforme la normativa tributaria y de facturación vigente, o requerimientos judiciales fundados), cadeApp suministrará únicamente la información estrictamente exigible por ley.',
        ],
      },
      {
        id: 'conservacion',
        title: '9. Conservación y seguridad',
        paragraphs: [
          'Los datos se conservan durante el tiempo necesario para las finalidades informadas, la seguridad, la resolución de incidentes y el respaldo de obligaciones legales. Los consentimientos se conservan por versión para acreditar qué documento fue aceptado y cuándo.',
          'cadeApp aplica controles de acceso por rol, políticas de seguridad en base de datos, almacenamiento privado para documentación y auditoría de accesos administrativos.',
        ],
      },
      {
        id: 'derechos',
        title: '10. Derechos de acceso, rectificación y supresión (ARCO)',
        paragraphs: [
          'La persona titular puede ejercer el derecho de acceso a sus datos en forma gratuita a intervalos no inferiores a seis meses, salvo interés legítimo acreditado (artículo 14, inciso 3 de la Ley 25.326). Los pedidos de rectificación, actualización o supresión proceden conforme al artículo 16 de la misma ley.',
          'Los pedidos de acceso se responderán en un plazo máximo de 10 días corridos y los de rectificación, actualización o supresión en un plazo máximo de 5 días hábiles. Las solicitudes se canalizan a través de WhatsApp +54 3865 575688 o el correo lautarojimenez02@gmail.com.',
          'Si una solicitud no es atendida en los términos legales, la persona titular podrá acudir a la Agencia de Acceso a la Información Pública (AAIP), órgano de control de la Ley 25.326, o ejercer la acción judicial de hábeas data.',
        ],
      },
      {
        id: 'cambios',
        title: '11. Cambios a esta Política',
        paragraphs: [
          'Las modificaciones se publican con nueva versión y fecha. El historial de aceptaciones no se sobrescribe. Si un cambio requiere un nuevo consentimiento, se solicitará expresamente.',
        ],
      },
    ],
  },
  courier_contract: {
    document: 'courier_contract',
    href: '/legal/courier',
    title: 'Condiciones para repartidores',
    shortTitle: 'Condiciones para repartidores',
    version: '1.0',
    effectiveDate: '2026-09-25',
    updatedLabel: UPDATED_LABEL,
    intro:
      'Estas condiciones describen la participación de repartidores en cadeApp y complementan los Términos generales y la Política de Privacidad.',
    sections: [
      {
        id: 'modelo',
        title: '1. Modelo de participación',
        paragraphs: [
          'cadeApp muestra solicitudes abiertas y permite presentar ofertas. La plataforma no asigna unilateralmente un viaje ni obliga a permanecer disponible.',
          'El repartidor decide cuándo marcarse disponible, qué solicitudes evaluar y si desea ofertar. También decide el importe de su oferta dentro de las reglas operativas vigentes y puede retirarla mientras continúe pendiente.',
        ],
      },
      {
        id: 'organizacion',
        title: '2. Organización de la actividad',
        bullets: [
          'No se establece exclusividad con cadeApp.',
          'cadeApp no fija una jornada ni exige una cantidad mínima de viajes.',
          'El repartidor elige su medio de movilidad entre las opciones admitidas y organiza la ejecución de cada entrega que acepta.',
          'El repartidor debe cumplir las normas de tránsito, habilitaciones y demás obligaciones legalmente exigibles para su actividad.',
        ],
      },
      {
        id: 'cobro',
        title: '3. Ofertas y cobro',
        paragraphs: [
          'Cada oferta expresa cuánto pretende cobrar el repartidor por esa entrega. El sistema aplica un piso operativo configurable, pero no fija el precio final: el comercio elige entre las ofertas disponibles.',
          'El destinatario paga el importe de la entrega directamente al repartidor. cadeApp no recibe, liquida, retiene ni garantiza ese dinero.',
        ],
      },
      {
        id: 'documentacion',
        title: '4. Identidad y documentación',
        paragraphs: [
          'cadeApp solicita DNI, selfie, avatar y datos básicos del vehículo. La licencia y el seguro pueden ser opcionales dentro del perfil, pero esa opcionalidad no reemplaza obligaciones legales exigibles para circular o realizar una actividad concreta.',
          'Una insignia de documentación sólo indica que un administrador revisó el archivo cargado; no constituye una certificación pública.',
        ],
      },
      {
        id: 'confidencialidad',
        title: '5. Confidencialidad de datos',
        paragraphs: [
          'Los datos exactos del destinatario y de los puntos de entrega se revelan después de aceptar la oferta. Deben usarse sólo para coordinar y completar el viaje asignado y no pueden reutilizarse para fines ajenos.',
        ],
      },
      {
        id: 'naturaleza',
        title: '6. Naturaleza jurídica',
        paragraphs: [
          'Estas condiciones describen el modelo operativo previsto por cadeApp y no pretenden alterar mediante una etiqueta la naturaleza jurídica que resulte de los hechos. La existencia o no de una relación de dependencia se determina conforme las circunstancias reales y la legislación argentina aplicable.',
          'Ninguna cláusula implica renuncia anticipada a derechos que la ley considere indisponibles.',
        ],
      },
      {
        id: 'versiones',
        title: '7. Versiones',
        paragraphs: [
          'La versión aceptada queda registrada. Si estas condiciones cambian materialmente, se solicitará aceptar la nueva versión antes de continuar con las funciones alcanzadas. Las aceptaciones anteriores permanecen en el historial.',
        ],
      },
    ],
  },
  pilot_terms: {
    document: 'pilot_terms',
    href: '/legal/pilot',
    title: 'Términos del piloto para comercios',
    shortTitle: 'Términos del piloto',
    version: '1.0',
    effectiveDate: '2026-09-25',
    updatedLabel: UPDATED_LABEL,
    intro:
      'Estos términos regulan la etapa inicial de cadeApp para comercios y emprendimientos de Aguilares. Complementan los Términos generales y la Política de Privacidad.',
    sections: [
      {
        id: 'alcance',
        title: '1. Alcance del piloto',
        paragraphs: [
          'El piloto está limitado a Aguilares, Tucumán, y busca validar el funcionamiento operativo. Durante esta etapa el uso del servicio de plataforma se encuentra bonificado para los comercios habilitados.',
        ],
      },
      {
        id: 'funciones',
        title: '2. Funciones incluidas',
        bullets: [
          'Publicar solicitudes de entrega dentro del alcance geográfico habilitado.',
          'Recibir ofertas de repartidores habilitados y elegir una.',
          'Coordinar la entrega y comunicar al destinatario el importe del flete aceptado.',
          'Acceder al historial, estados y canales de contacto informados para la operación del piloto.',
        ],
      },
      {
        id: 'pagos',
        title: '3. Pagos',
        paragraphs: [
          'cadeApp no cobra comisión sobre el importe de cada flete. El destinatario paga ese importe directamente al repartidor.',
          'La finalización del piloto no genera un cobro automático. Si luego se ofrece un abono por usar la plataforma, sus condiciones, precio y vigencia deben informarse antes de que el comercio decida adherirse.',
        ],
      },
      {
        id: 'destinatario',
        title: '4. Datos de destinatarios',
        paragraphs: [
          'Al cargar nombre, teléfono, dirección o referencias de un destinatario, el comercio manifiesta y garantiza haber informado previamente a dicha persona y contar con una base jurídica válida conforme al artículo 11 de la Ley 25.326 (incluido el consentimiento previo si correspondiese) para comunicar sus datos a cadeApp y al repartidor seleccionado en la medida necesaria para coordinar y completar la entrega.',
          'El comercio no debe cargar datos innecesarios para la entrega ni usar la plataforma para compartir información de terceros con otros fines.',
        ],
      },
      {
        id: 'finalizacion',
        title: '5. Duración y finalización',
        paragraphs: [
          'El período del piloto tiene una duración máxima de hasta 7 (siete) días corridos contados desde el alta y habilitación del comercio en la plataforma.',
          'cadeApp podrá dar por finalizado o pausar el piloto con anterioridad a dicho plazo por decisión operativa, informando debidamente dicha circunstancia al comercio mediante los canales de contacto habilitados.',
          'La finalización o vencimiento del período piloto no genera ningún cobro retroactivo ni produce la adhesión o migración automática a planes o servicios pagos. Cualquier modalidad posterior arancelada requerirá información previa sobre condiciones, costos y modalidades de pago, así como la aceptación expresa y separada del comercio antes de su entrada en vigencia.',
          'La finalización del piloto no modifica el historial de solicitudes ni los consentimientos registrados, los cuales se conservan conforme las reglas de auditoría y privacidad aplicables.',
        ],
      },
      {
        id: 'version',
        title: '6. Versión aceptada',
        paragraphs: [
          'La aceptación se registra con la versión vigente. Si la versión mostrada no coincide con la vigente del servidor, la operación se rechaza y debe mostrarse el documento actualizado antes de volver a aceptar.',
        ],
      },
    ],
  },
};

export function getLegalDocument(document: LegalDocumentName): LegalDocumentDescriptor {
  return LEGAL_DOCUMENTS[document];
}

export function getAllLegalDocuments(): readonly LegalDocumentDescriptor[] {
  return [
    LEGAL_DOCUMENTS.tos,
    LEGAL_DOCUMENTS.privacy,
    LEGAL_DOCUMENTS.courier_contract,
    LEGAL_DOCUMENTS.pilot_terms,
  ];
}
