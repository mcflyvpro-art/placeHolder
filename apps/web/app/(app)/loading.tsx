import s from './loading.module.css';

/** Squelette affiché instantanément pendant le rendu serveur : la navigation ne « gèle » jamais. */
export default function Loading() {
  return (
    <div className={s.wrap} aria-busy="true" aria-label="Chargement">
      <div className={s.header}><span className={s.title} /></div>
      <div className={s.grid}>
        <span className={s.block} />
        <span className={s.block} />
        <span className={`${s.block} ${s.tall}`} />
      </div>
    </div>
  );
}
