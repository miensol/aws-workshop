const imageKeys = [
  'adam_w_team.png',
  'damian_p_team.png',
  'maciejm_team.png',
  'michal_d_team.png',
  'patryks_team.png',
  'paulinat_team.png',
  'tomasz_l_team.png',
]
const random = ({ min = 0, max = 1 }) => Math.floor(Math.random() * (max - min) + min)
export const randomImageKey = () => imageKeys[random({ max: imageKeys.length })]
export const randomSize = () => random({ min: 100, max: 200 })
