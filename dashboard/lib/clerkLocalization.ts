// @clerk/localizations@3.37.6's es-ES pack deja varias claves sin traducir
// (valen `undefined`, así que Clerk cae al inglés) — sobre todo el feedback
// de fortaleza de contraseña (zxcvbn), que es justo lo que ve cualquiera al
// registrarse. Aquí rellenamos esas claves a mano sobre el paquete oficial.
import { esES } from '@clerk/localizations';

export const clerkLocalizationES = {
  ...esES,
  unstable__errors: {
    ...esES.unstable__errors,
    form_new_password_matches_current: 'La nueva contraseña no puede ser igual a la actual.',
    form_password_untrusted__sign_in:
      'Tu contraseña parece haber sido comprometida o ya no es de confianza y no se puede usar. Por favor, prueba con otra contraseña.',
    web3_missing_identifier: 'No se ha encontrado ninguna extensión de Web3 Wallet. Instala una para continuar.',
    zxcvbn: {
      couldBeStronger: 'Tu contraseña funciona, pero podría ser más fuerte. Prueba a añadir más caracteres.',
      goodPassword: 'Tu contraseña cumple todos los requisitos necesarios.',
      notEnough: 'Tu contraseña no es lo bastante segura.',
      suggestions: {
        allUppercase: 'Pon en mayúscula algunas letras, pero no todas.',
        anotherWord: 'Añade más palabras que sean menos comunes.',
        associatedYears: 'Evita años asociados a ti.',
        capitalization: 'Pon en mayúscula más de la primera letra.',
        dates: 'Evita fechas y años asociados a ti.',
        l33t: "Evita sustituciones de letras predecibles, como '@' por 'a'.",
        longerKeyboardPattern: 'Usa patrones de teclado más largos y cambia de dirección varias veces.',
        noNeed: 'Puedes crear contraseñas seguras sin usar símbolos, números o mayúsculas.',
        pwned: 'Si usas esta contraseña en otro sitio, deberías cambiarla.',
        recentYears: 'Evita años recientes.',
        repeated: 'Evita palabras y caracteres repetidos.',
        reverseWords: 'Evita escribir al revés palabras comunes.',
        sequences: 'Evita secuencias de caracteres comunes.',
        useWords: 'Usa varias palabras, pero evita frases comunes.',
      },
      warnings: {
        common: 'Esta es una contraseña muy usada.',
        commonNames: 'Los nombres y apellidos comunes son fáciles de adivinar.',
        dates: 'Las fechas son fáciles de adivinar.',
        extendedRepeat: 'Los patrones repetidos como "abcabcabc" son fáciles de adivinar.',
        keyPattern: 'Los patrones cortos de teclado son fáciles de adivinar.',
        namesByThemselves: 'Los nombres o apellidos solos son fáciles de adivinar.',
        pwned: 'Tu contraseña se filtró en una fuga de datos en internet.',
        recentYears: 'Los años recientes son fáciles de adivinar.',
        sequences: 'Las secuencias de caracteres comunes como "abc" son fáciles de adivinar.',
        similarToCommon: 'Esta contraseña es parecida a una muy usada.',
        simpleRepeat: 'Los caracteres repetidos como "aaa" son fáciles de adivinar.',
        straightRow: 'Las filas seguidas de teclas del teclado son fáciles de adivinar.',
        topHundred: 'Esta es una contraseña usada con frecuencia.',
        topTen: 'Esta es una contraseña muy usada.',
        userInputs: 'No debe contener datos personales ni relacionados con la página.',
        wordByItself: 'Las palabras sueltas son fáciles de adivinar.',
      },
    },
  },
  signIn: {
    ...esES.signIn,
    passwordCompromised: { ...esES.signIn?.passwordCompromised, title: 'Contraseña comprometida' },
    passwordUntrusted: { ...esES.signIn?.passwordUntrusted, title: 'Contraseña no confiable' },
  },
};
