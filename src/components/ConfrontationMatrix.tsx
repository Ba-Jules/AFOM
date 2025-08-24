import React from "react";

/**
 * Matrice de confrontation – scaffold compilable.
 * - Pas d’accès Firestore ici (branché depuis MatrixMode).
 * - Toutes les map() déclarent leurs index (ri, ci, rItemIdx, cItemIdx).
 * - Totaux/notations sont placeholders pour l’instant.
 */

type Section = {
  title: string;
  items: string[];
};

const rows: Section[] = [
  {
    title: "Opportunités",
    items: [
      "Nombreuses structures traditionnelles",
      "Libération effective des initiatives",
      "Collaboration entre syndicats et OCB",
      "Partenaires au développement sur le terrain",
    ],
  },
  {
    title: "Menaces",
    items: [
      "Ethnocentrisme très poussé",
      "Peur et peu de confiance en soi",
      "Déviations (opportunisme, etc.)",
      "Insuffisance de dialogue État/partis/OSC",
    ],
  },
];

const cols: Section[] = [
  {
    title: "Acquis",
    items: [
      "Émergence d’une société civile",
      "Volonté de regroupement",
      "Bonne connaissance du terrain",
      "Crédibilité des OSC auprès des bailleurs",
    ],
  },
  {
    title: "Faiblesses",
    items: [
      "Faible capacité de mobilisation",
      "Leadership peu développé au sein des OSC",
      "Rivalités entre centrales",
      "Engagement politique des leaders",
    ],
  },
];

const ConfrontationMatrix: React.FC = () => {
  // Placeholder visuel : à remplacer par ton marquage réel (O×A, O×F, M×A, M×F)
  const marks: Record<string, boolean> = {};

  const cellId = (ri: number, ci: number, rItemIdx: number, cItemIdx: number) =>
    `r${ri}-${rItemIdx}_c${ci}-${cItemIdx}`;

  const HeaderCols = () => (
    <>
      <tr>
        <th className="bg-white"></th>
        {cols.map((col, ci) => (
          <th
            key={`ch-${ci}`}
            className="bg-amber-100 text-[12px] font-bold px-2 py-1 border text-center"
          >
            {col.title}
          </th>
        ))}
        <th className="bg-amber-50 text-[12px] font-bold px-2 py-1 border">Total</th>
      </tr>
      <tr>
        <th className="bg-white"></th>
        {cols.map((col, ci) => (
          <th key={`ch2-${ci}`} className="bg-amber-50 px-0 py-0 border align-top">
            <table className="w-full border-collapse">
              <tbody>
                {col.items.map((it, cItemIdx) => (
                  <tr key={`col-item-${ci}-${cItemIdx}`}>
                    <th className="text-[11px] font-medium text-gray-700 px-2 py-1 border text-left">
                      {it}
                    </th>
                  </tr>
                ))}
              </tbody>
            </table>
          </th>
        ))}
        <th className="bg-amber-50 px-2 py-1 border"></th>
      </tr>
    </>
  );

  const BodyRows = () => (
    <>
      {rows.map((row, ri) => (
        <React.Fragment key={`r-${ri}`}>
          <tr>
            <th
              className="bg-emerald-100 text-[12px] font-bold px-2 py-1 border text-left"
              colSpan={cols.length + 2}
            >
              {row.title}
            </th>
          </tr>

          {row.items.map((rItem, rItemIdx) => (
            <tr key={`rline-${ri}-${rItemIdx}`}>
              <th className="text-[11px] font-medium text-gray-700 px-2 py-1 border bg-gray-50 align-top">
                {rItem}
              </th>

              {cols.map((col, ci) => (
                <td key={`cell-wrap-${ri}-${rItemIdx}-${ci}`} className="p-0 border">
                  <table className="w-full border-collapse">
                    <tbody>
                      {col.items.map((_, cItemIdx) => {
                        const id = cellId(ri, ci, rItemIdx, cItemIdx);
                        const checked = !!marks[id];
                        return (
                          <tr key={`cell-${ri}-${rItemIdx}-${ci}-${cItemIdx}`}>
                            <td className="border px-2 py-1 text-center">
                              <span
                                className={`inline-block w-4 h-4 rounded ${
                                  checked ? "bg-emerald-500" : "bg-gray-200"
                                }`}
                                title={id}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </td>
              ))}

              {/* total ligne (placeholder) */}
              <td className="border bg-gray-50 text-center text-sm font-semibold">00</td>
            </tr>
          ))}
        </React.Fragment>
      ))}

      {/* Totaux bas (placeholder) */}
      <tr>
        <th className="bg-gray-100 text-[12px] font-bold px-2 py-1 border text-right">
          Total
        </th>
        {cols.map((_, ci) => (
          <td key={`ct-${ci}`} className="border text-center text-sm font-semibold">
            00
          </td>
        ))}
        <td className="border bg-gray-50 text-center text-sm font-semibold">00</td>
      </tr>
    </>
  );

  return (
    <div className="max-w-[1100px] mx-auto p-4">
      <h2 className="text-2xl font-extrabold mb-4">Matrice de confrontation</h2>
      <div className="overflow-auto rounded-lg shadow">
        <table className="min-w-[980px] w-full border-collapse">
          <thead>
            <HeaderCols />
          </thead>
          <tbody>
            <BodyRows />
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-gray-500 mt-3">
        (Scaffold : brancher l’auto-préremplissage et les calculs O×A, O×F, M×A, M×F ensuite.)
      </p>
    </div>
  );
};

export default ConfrontationMatrix;
