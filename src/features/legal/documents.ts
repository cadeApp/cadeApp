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
          'El canal de contacto operativo es la opción de soporte disponible dentro de cadeApp. La operación del proyecto tiene base en Aguilares, Tucumán, Argentina.',
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
      'Esta Política explica qué datos trata cadeApp, para qué los utiliza, con quién puede compartirlos y cómo ejercer los derechos previstos por la Ley 25.326 y su reglamentación.',
    sections: [
      {
        id: 'responsable',
        title: '1. Responsable y contacto',
        paragraphs: [
          'El responsable de la operación de cadeApp es Lautaro Emanuel Jimenez, titular del proyecto, con base y domicilio de contacto en Aguilares, Tucumán, Argentina.',
          'Las solicitudes sobre datos personales pueden iniciarse mediante el canal de soporte disponible dentro de cadeApp. Antes de entregar o modificar información personal se puede verificar la identidad de quien formula el pedido.',
        ],
      },
      {
        id: 'datos',
        title: '2. Datos que tratamos',
        bullets: [
          'Cuenta y perfil: identificador de usuario, rol, nombre mostrado, email, teléfono y datos de autenticación gestionados por el proveedor de identidad.',
          'Comercios: nombre del negocio, zona, dirección de retiro, referencias y coordenadas cuando se utiliza el mapa.',
          'Repartidores: DNI informado, imágenes de DNI, selfie, avatar, vehículo y patente cuando corresponda; licencia y seguro sólo si se cargan.',
          'Entregas: barrios, direcciones, coordenadas cuando se usan, tipo de paquete, notas, estados, ofertas e incidentes.',
          'Destinatarios que no son usuarios: nombre, teléfono, dirección, referencias, punto de entrega y medio de pago informado por el comercio.',
          'Datos técnicos necesarios para sesión, seguridad, auditoría y notificaciones push cuando se habilitan.',
        ],
      },
      {
        id: 'finalidades',
        title: '3. Para qué usamos los datos',
        bullets: [
          'Crear y proteger cuentas, aplicar permisos por rol y prevenir accesos indebidos.',
          'Permitir el alta de comercios y la revisión de repartidores.',
          'Publicar, ofertar, seleccionar, coordinar y completar entregas.',
          'Aplicar la revelación progresiva de datos y mostrar información exacta sólo a quienes estén autorizados.',
          'Atender incidentes, soporte, seguridad, auditoría y obligaciones legales.',
          'Enviar notificaciones operativas cuando la persona las habilita; esas notificaciones no incluyen datos del destinatario.',
        ],
      },
      {
        id: 'consentimiento',
        title: '4. Origen, consentimiento y otras bases permitidas',
        paragraphs: [
          'Los datos de una persona usuaria se obtienen directamente de ella o se generan durante el uso de la plataforma. Cuando se solicita consentimiento, se registra la versión del documento que se presentó al momento de aceptar.',
          'También pueden tratarse datos cuando sean necesarios para ejecutar la relación solicitada por la persona usuaria o cuando exista otra base permitida por la legislación aplicable.',
        ],
      },
      {
        id: 'destinatarios',
        title: '5. Datos de la persona destinataria',
        paragraphs: [
          'El comercio aporta los datos del destinatario y declara haber informado a esa persona sobre el uso necesario para coordinar la entrega. cadeApp no utiliza esos datos para publicidad ni los publica en el feed abierto.',
          'El nombre, teléfono, direcciones y coordenadas exactas quedan limitados al comercio dueño, al repartidor seleccionado y a administradores autorizados cuando su función lo requiere.',
        ],
      },
      {
        id: 'documentos',
        title: '6. DNI, selfie y documentos del repartidor',
        paragraphs: [
          'Los documentos de identidad y la selfie se almacenan en un espacio privado. Su lectura administrativa requiere acceso autorizado y queda auditada.',
          'La política operativa de cadeApp prevé conservar DNI y selfie mientras el repartidor permanezca activo y eliminarlos 30 días después de una baja o rechazo. Esos archivos se mantienen fuera del esquema general de backup de documentos.',
        ],
      },
      {
        id: 'proveedores',
        title: '7. Proveedores y transferencias internacionales',
        paragraphs: [
          'cadeApp utiliza proveedores tecnológicos para autenticación, base de datos, almacenamiento, hosting, mapas y notificaciones, en la medida necesaria para prestar esas funciones.',
          'La infraestructura de algunos proveedores puede implicar tratamiento fuera de Argentina. Las transferencias internacionales se sujetan al artículo 12 de la Ley 25.326, su reglamentación y las garantías aplicables cuando corresponda.',
        ],
      },
      {
        id: 'conservacion',
        title: '8. Conservación y seguridad',
        paragraphs: [
          'Los datos se conservan durante el tiempo necesario para las finalidades informadas, la seguridad, la resolución de incidentes y las obligaciones legales. Los consentimientos se conservan por versión para acreditar qué documento fue aceptado y cuándo.',
          'cadeApp aplica controles de acceso por rol, políticas de base de datos, almacenamiento privado para documentación y auditoría de accesos administrativos.',
        ],
      },
      {
        id: 'derechos',
        title: '9. Derechos de las personas',
        paragraphs: [
          'La persona titular puede solicitar acceso a sus datos y, cuando corresponda, su actualización, rectificación, confidencialidad o supresión. La Ley 25.326 prevé diez días corridos para responder un pedido de acceso y cinco días hábiles para rectificar, actualizar o suprimir cuando corresponda.',
          'Si una solicitud no es atendida en los términos legales, la persona puede acudir a la Agencia de Acceso a la Información Pública (AAIP) o ejercer la acción de hábeas data prevista por la ley.',
        ],
      },
      {
        id: 'cambios',
        title: '10. Cambios a esta Política',
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
          'Acceder al historial, estados e instrumentos de soporte disponibles durante el piloto.',
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
          'Al cargar nombre, teléfono, dirección o referencias de un destinatario, el comercio declara haber informado a esa persona que esos datos se usarán para coordinar la entrega y se revelarán al repartidor seleccionado en la medida necesaria.',
          'El comercio no debe cargar datos innecesarios para la entrega ni usar la plataforma para compartir información de terceros con otros fines.',
        ],
      },
      {
        id: 'finalizacion',
        title: '5. Duración y finalización',
        paragraphs: [
          'La etapa piloto puede finalizar, pausarse o transformarse en una modalidad posterior. cadeApp informará el cambio antes de exigir nuevas condiciones económicas o una nueva aceptación.',
          'La finalización del piloto no modifica el historial de solicitudes ni consentimientos ya registrados, sujetos a las reglas de conservación aplicables.',
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
