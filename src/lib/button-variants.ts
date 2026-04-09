/**
 * Call Center Button Variants
 * Defines all button styles used in call center interface
 */

export const CALL_CENTER_BUTTONS = {
  // PRIMARY ACTIONS (Confirm, Call)
  primary: {
    className: 'bg-green-600 hover:bg-green-700 text-white font-semibold',
    icon: 'left', // Icon on left side
    size: 'default', // h-10
  },

  // SECONDARY ACTIONS (View, Close)
  secondary: {
    className: 'bg-white hover:bg-gray-50 text-gray-900 border-2 border-gray-300 font-semibold',
    icon: 'left',
    size: 'default',
  },

  // DANGER ACTIONS (Cancel Order, Delete)
  danger: {
    className: 'bg-red-600 hover:bg-red-700 text-white font-semibold',
    icon: 'left',
    size: 'default',
  },

  // WARNING ACTIONS (Callback, Busy)
  warning: {
    className: 'bg-orange-500 hover:bg-orange-600 text-white font-semibold',
    icon: 'left',
    size: 'default',
  },

  // NEUTRAL OUTCOMES (No Answer, Unreached)
  neutral: {
    className: 'bg-white hover:bg-gray-50 text-gray-700 border-2 border-gray-400 font-semibold',
    icon: 'left',
    size: 'default',
  },
} as const;

/**
 * Get consistent button props for call center actions
 */
export function getCallActionButton(
  action: 'confirm' | 'call' | 'no_answer' | 'busy' | 'callback' | 'cancel' | 'close'
) {
  switch (action) {
    case 'confirm':
      return {
        variant: 'primary' as const,
        icon: 'check',
        text: 'Confirmer',
        ariaLabel: 'Confirmer la commande',
      };

    case 'call':
      return {
        variant: 'primary' as const,
        icon: 'phone',
        text: 'Appeler',
        ariaLabel: 'Appeler le client',
      };

    case 'no_answer':
      return {
        variant: 'neutral' as const,
        icon: 'phone-missed',
        text: 'Pas de réponse',
        ariaLabel: 'Enregistrer pas de réponse',
      };

    case 'busy':
      return {
        variant: 'warning' as const,
        icon: 'phone-off',
        text: 'Occupé',
        ariaLabel: 'Enregistrer ligne occupée',
      };

    case 'callback':
      return {
        variant: 'warning' as const,
        icon: 'phone-callback',
        text: 'Rappel',
        ariaLabel: 'Programmer un rappel',
      };

    case 'cancel':
      return {
        variant: 'danger' as const,
        icon: 'x',
        text: 'Annuler',
        ariaLabel: 'Annuler la commande',
      };

    case 'close':
      return {
        variant: 'secondary' as const,
        icon: 'x',
        text: 'Fermer',
        ariaLabel: 'Fermer le panneau',
      };
  }
}

export type CallActionType = 'confirm' | 'call' | 'no_answer' | 'busy' | 'callback' | 'cancel' | 'close';
