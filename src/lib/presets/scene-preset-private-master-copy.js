export const SCENE_PRIVATE_MASTER_LOCALES=Object.freeze(['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']);
const C=Object.freeze({
en:{title:'Capture & Save',description:'Turn the selected objects and required SubGrid descendants into a private Scene master. Publishing is a separate step.',save:'Save Private Master',saved:'Private master saved.',continuePublish:'Continue to Publish',changes:'Changes not published'},
fr:{title:'Capturer et enregistrer',description:'Transformez la sélection en master Scene privé. La publication est une étape distincte.',save:'Enregistrer le master privé',saved:'Master privé enregistré.',continuePublish:'Continuer vers la publication',changes:'Modifications non publiées'},
it:{title:'Cattura e salva',description:'Trasforma la selezione in un master Scene privato. La pubblicazione è un passaggio separato.',save:'Salva master privato',saved:'Master privato salvato.',continuePublish:'Continua alla pubblicazione',changes:'Modifiche non pubblicate'},
de:{title:'Erfassen & speichern',description:'Wandle die Auswahl in einen privaten Scene-Master um. Die Veröffentlichung ist ein separater Schritt.',save:'Privaten Master speichern',saved:'Privater Master gespeichert.',continuePublish:'Weiter zur Veröffentlichung',changes:'Nicht veröffentlichte Änderungen'},
'es-ES':{title:'Capturar y guardar',description:'Convierte la selección en un master Scene privado. Publicar es un paso separado.',save:'Guardar master privado',saved:'Master privado guardado.',continuePublish:'Continuar a Publicar',changes:'Cambios sin publicar'},
ja:{title:'Capture & Save',description:'選択内容をprivate Scene masterへ変換します。Publishは別の操作です。',save:'Private Masterを保存',saved:'Private masterを保存しました。',continuePublish:'Publishへ進む',changes:'Changes not published'},
'zh-CN':{title:'捕获并保存',description:'将选择内容转换为私有 Scene master。发布是独立步骤。',save:'保存 Private Master',saved:'Private master 已保存。',continuePublish:'继续发布',changes:'未发布的更改'},
'pt-BR':{title:'Capturar e salvar',description:'Transforme a seleção em um master Scene privado. Publicar é uma etapa separada.',save:'Salvar master privado',saved:'Master privado salvo.',continuePublish:'Continuar para Publicar',changes:'Alterações não publicadas'}
});
export function scenePrivateMasterCopy(locale){return C[locale]??C.en;}
