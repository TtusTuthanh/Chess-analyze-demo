# Chess PGN Analyzer

Web app phân tích cờ vua **chạy hoàn toàn ở client**, xây dựng bằng React,
TypeScript, Vite, chess.js và Stockfish 19 WebAssembly. Không cần backend, tài
khoản, API key hay dịch vụ engine bên ngoài.

## Chạy project

Yêu cầu **Node.js 22.12+** (đã kiểm tra với Node 22) và npm.

```bash
npm ci
npm run dev
```

Mở địa chỉ Vite in ra (mặc định `http://localhost:5173`). Server bind
`0.0.0.0` và cho phép host của live preview.

```bash
npm run build       # typecheck + production build vào dist/
npm run preview     # xem production build
npm test            # unit tests
npx playwright install chromium
npm run test:e2e    # test trình duyệt với Stockfish WASM thật
```

Nếu môi trường đã có Chromium riêng:

```bash
CHROMIUM_PATH=/path/to/chromium npm run test:e2e
```

`predev` và `build` chạy `scripts/setup-engine.mjs`, copy bản lite single-thread
của Stockfish từ npm sang `public/engine`. Assets được phục vụ **cùng origin**,
không phụ thuộc CDN. Thư mục engine sinh tự động, `node_modules`, `dist`, ảnh
kiểm thử và browser binaries không cần đưa vào Git.

Deploy `dist/` lên static hosting tại root path `/`, qua HTTPS. Browser cần
WebAssembly và Web Worker; bản engine single-thread không yêu cầu COOP/COEP hay
SharedArrayBuffer. Phục vụ `.wasm` với MIME `application/wasm`. Giữ nguyên
`/engine`, `/pieces`, `/fonts` khi deploy. Không mở trực tiếp `index.html` bằng
`file://`. Cấu hình `allowedHosts: true` phục vụ sandbox; nên giới hạn host nếu
đưa dev server lên môi trường công khai.

## Luồng sử dụng

1. App mở sẵn **Opera Game — Paul Morphy vs Duke Karl / Count Isouard**, kèm
   một variation và các chú thích mẫu. Nếu có project đã lưu cục bộ, app khôi
   phục project đó thay cho sample.
2. **Import PGN**: paste text, chọn file `.pgn`, kéo thả file; **Load example
   game** khôi phục sample. Cùng hộp thoại nhận project `.json`.
3. Click nước đi hoặc variation để đổi vị trí. Dùng Previous/Next, First/Last,
   Play/Pause hoặc timeline. Lật bàn, bật/tắt tọa độ, best-move arrow hoặc focus
   board bằng toolbar.
4. **Start analysis** bật tự phân tích vị trí đang xem; chuyển nước đi sẽ hủy
   search cũ. **Analyze current position** là phân tích một lần. Để so sánh,
   app phân tích thêm vị trí trước nước đi nếu chưa có cache hợp lệ.
5. **Analyze entire game** duyệt main line tuần tự, có Pause/Resume. Vị trí đã
   đủ depth/MultiPV được lấy từ cache. Đổi vị trí hoặc setting sẽ hủy search
   và pause batch. Variation được phân tích riêng khi chọn.
6. Annotation editor hỗ trợ comment, NAG, màu và công cụ vẽ. **Save** lưu thay
   đổi, **Cancel** khôi phục phiên bản đã lưu. Chuyển vị trí tự lưu draft để
   không mất công việc. Có thể xóa comment/NAG bằng cách bỏ nội dung rồi Save.
7. Kéo chuột phải vẽ arrow, click chuột phải highlight. Lặp lại cùng drawing
   để xóa; có nút Clear drawings. Trên thiết bị cảm ứng, chọn công cụ arrow
   hoặc highlight trước. Drawing cũng là annotation draft và cần Save.
8. **Variation** nhận một continuation từ vị trí hiện tại, ví dụ `Nf3 Nc6`
   hoặc UCI `g1f3 b8c6`. Có thể di chuyển quân trực tiếp để thêm continuation;
   app chỉ chấp nhận nước hợp lệ và hỏi quân phong cấp. Nhánh đã tồn tại sẽ
   được dùng lại, không nhân đôi. Click PV của engine để thêm tối đa 10
   half-moves. Nhánh thay thế có nút xóa; có thể sửa bằng xóa rồi nhập lại.
9. **Export game**: copy/download PGN, save project JSON, export report
   Markdown/JSON. PGN giữ header tùy chỉnh, comments, NAG, cây variation và
   các directive `%cal`/`%csl`. Dấu `{`/`}` người dùng nhập bên trong comment
   được chuẩn hóa thành `(`/`)` để xuất PGN hợp lệ.
10. **Game report** trình bày accuracy ước tính, các lỗi lớn nhất, phân bố phase
    và kết quả ván. Nếu chưa phân tích hết, report được đánh dấu partial.

Giao diện có light/dark mode. Desktop có 3 cột; tablet có 2 cột; mobile dùng
Board / Moves / Analysis tabs. Font, quân cờ và engine đều phục vụ cục bộ.

## Phím tắt

| Phím           | Thao tác                                                  |
| -------------- | --------------------------------------------------------- |
| `←` / `→`      | Previous / Next                                           |
| `Home` / `End` | Đầu / cuối nhánh hiện tại                                 |
| `Space`        | Play / Pause                                              |
| `Ctrl/Cmd + Z` | Undo annotation/variation đã lưu; nếu có draft, hủy draft |
| `Ctrl/Cmd + S` | Download project JSON, bao gồm draft hiện tại             |
| `Escape`       | Đóng dialog                                               |

Phím duyệt không can thiệp khi đang gõ trong input/textarea. Undo native của
textarea vẫn hoạt động. Lịch sử undo giữ tối đa 40 phiên bản trong session.

## Engine và phân loại

- Engine: **Stockfish 19 lite single-thread WASM**, chạy trong dedicated Worker.
- Depth mặc định 14, chỉnh bằng `−` / `+`, giới hạn 8–22.
- MultiPV: 1 / 2 / 3 / 5. Nhiều line và depth lớn tốn CPU/thời gian hơn.
- Một search tại một thời điểm. Hủy bằng `worker.terminate()` và khởi tạo lại
  khi cần; kết quả search cũ không thể lẫn vào vị trí mới.
- Cache theo **full FEN**; chỉ reuse khi kết quả hoàn tất và depth/MultiPV đủ.
- Điểm UCI vốn theo side-to-move được chuẩn hóa về **góc nhìn Trắng**. Điểm
  dương có lợi cho Trắng; M là forced mate. Có nodes, NPS, depth, PV và trạng
  thái thinking; timeout/lỗi Worker có thông báo và có thể retry.
- Loss = `max(0, (evalBefore - evalAfter) × moverSign)` theo pawn.
- Mặc định: `< 0.30` Good/Best, `0.30–<0.80` Inaccuracy, `0.80–1.50` Mistake,
  `>1.50` Blunder. Các ngưỡng nằm trong `DEFAULT_THRESHOLDS`, có thể thay ở
  nút setting của engine panel. App kiểm tra thứ tự các ngưỡng.
- Chỉ phân loại khi cả before/after đã hoàn tất. Đổi cấu hình depth có thể
  dùng kết quả đã hoàn tất cũ trong lúc search mới chạy; engine depth hiển
  thị công khai để người dùng biết mức phân tích.
- Mate xử lý riêng: mất forced mate là **Missed win**; từ chưa thua forced
  mate sang thua forced mate là **Blunder**. Không trừ mate như centipawn và
  không hiển thị một con số pawn-loss giả.
- **Brilliant/!! là NAG thủ công**, không tự suy diễn từ centipawn. Không gán
  nhãn missed tactic hoặc bịa explanation khi chỉ có evaluation/PV.

## Project và độ bền dữ liệu

Project version 1 gồm original PGN, headers, move tree, selected node,
annotations/drawings, engine cache đã hoàn tất, settings và thresholds.
Project import kiểm tra cây không có cycle/orphan, quan hệ parent-child,
SAN/UCI/FEN hợp lệ, drawings, cache và settings trước khi khôi phục.

Workspace đã lưu tự autosave vào `localStorage` sau khoảng 700ms. Đây **không
phải cloud backup**; quota, private browsing hoặc xóa dữ liệu browser có thể
làm mất dữ liệu. Nên export JSON để lưu lâu dài. Draft chưa Save không được
persist vào local autosave, nhưng được bao gồm khi export project. Project
lỗi khi khôi phục được thay bằng sample; không làm app crash.

Import xử lý **một ván** mỗi lần. PGN text tối đa 2 MB, file upload tối đa
5 MB, nesting variation tối đa 64. Parser thông báo line, token và lý do cho
lỗi nước đi/syntax; PGN rỗng hoặc metadata-only có thông báo riêng. Semicolon
comments, brace comments, NAG số/ký hiệu, custom FEN, phong cấp, nhập thành,
variation lồng nhau và header tùy chỉnh được hỗ trợ.

## Kiến trúc

```text
src/
  types.ts                    Game, MoveNode, Annotation, EngineAnalysis, Project
  App.tsx                     Workspace orchestration, navigation, undo, persistence
  components/
    ChessBoard.tsx            React board, legal moves, drawing overlay, promotion
    MoveList.tsx              Main line + recursive variation tree + game metadata
    AnnotationEditor.tsx      Comment/NAG/variation and drawing tools
    AnalysisPanel.tsx         Engine controls, evaluation, PV, move comparison
    Dialogs.tsx               Import, export, report, accessible modal, shortcuts
  lib/
    pgn.ts                    Tokenizer, chess.js legality, tree, lossless tree export
    engine.ts                 UCI/Worker lifecycle, score normalization, PV → SAN
    useEngine.ts              Search scheduling, caching, game batch + pause/resume
    analysis.ts               Configurable classification and honest report heuristic
    project.ts                Project validation and client-side downloads
    sample.ts                 Annotated Opera Game
  styles.css                  Responsive design tokens, components, dark mode
scripts/setup-engine.mjs     Local engine assets for development and production
```

MoveNode giữ danh sách `children`; phần tử đầu là main continuation, các phần
tử còn lại là alternative moves từ cùng vị trí cha. Không làm phẳng PGN bằng
`chess.history()`. `chess.js` kiểm tra legality của từng token từ FEN của node
cha. Export tạo RAV đúng vị trí trước khi tiếp tục main line. Board là React
component riêng với SVG pieces, không cần thư viện bàn cờ phụ thuộc khác.
Styling dùng CSS có design tokens thay vì Tailwind để giữ dependency nhỏ.

### Thêm opening database

MVP hiển thị `Opening`, `ECO`, `Variation` nếu có trong header (toàn bộ header
xem ở Game info); **chưa tự nhận diện** opening không được khai báo.

Thêm module `src/lib/openings.ts` với contract ví dụ:

```ts
interface OpeningMatch {
  name: string;
  eco?: string;
  variation?: string;
}
interface OpeningProvider {
  identify(uciLine: readonly string[]): OpeningMatch | undefined;
}
```

Dùng `mainLine(game).map(node => node.uci)`, tìm prefix dài nhất trong dữ liệu
ECO được cấp phép phù hợp. Gọi provider sau import, đưa kết quả nhận diện vào
view model riêng, ưu tiên header gốc. Không âm thầm ghi đè metadata gốc khi
export. Database lớn có thể lazy-load hoặc chạy trong Worker.

### Thêm engine / report format

Bọc engine mới sau contract `analyze(fen, settings, onUpdate)` / `stop()` của
`StockfishEngine`; luôn chuẩn hóa score trước khi đưa vào cache. Sau đó thêm
selector thực sự có implementation, không tạo option giả. Với PDF, sử dụng
`Report` DTO và viết formatter cạnh `reportMarkdown`, không gắn format xuất
với UI hoặc engine.

## Giới hạn có chủ ý

- Whole-game report chỉ main line; variation vẫn click/annotate/analyze được.
- Accuracy là heuristic `100 × exp(−0.35 × pawn loss)` trung bình, mate swing
  có penalty riêng. **Không phải accuracy chính thức** của nền tảng cờ nào.
- Phase là ước tính theo ply/material; critical moments dựa trên loss/mate.
- Không có cơ chế giải thích chiến thuật bằng ngôn ngữ tự nhiên, nhận diện
  brilliance tự động, opening database đầy đủ, cloud sync hoặc PDF.
- PGN export giữ ý nghĩa/cấu trúc, không giữ nguyên spacing/line wrapping.
- Analysis từng FEN không có toàn bộ lịch sử lặp lại thế cờ; không dùng engine
  output làm phán quyết chính thức về threefold repetition.
- Drawing trên root và mỗi node được giữ riêng. Undo không tồn tại sau reload.
- Browser rất cũ không có WASM/Worker có thể dùng các tính năng PGN/annotation
  nhưng sẽ nhận lỗi engine thân thiện.

## Kiểm thử

- **32 unit tests**: sample/checkmate, import/export nested tree, header escapes,
  NAG/drawings, custom FEN/promotion, malformed PGN, transactional variation,
  project validation/cycles, side-correct evaluation loss, thresholds, mate,
  PV conversion và report partial.
- **6 Chromium end-to-end tests**: engine WASM thật, navigation/cancellation,
  invalid-PGN recovery, annotation + nested-variation export/download, drawing
  directives + cancel/undo, whole-game analysis/report, pause/MultiPV/project
  restore, responsive mobile/legal moves/dark mode.

Xem `THIRD_PARTY_NOTICES.md` cho engine GPLv3, quân cờ CC BY-SA 3.0, font OFL
và các license dependency. Khi phân phối engine binary cần thực hiện đầy đủ
nghĩa vụ cung cấp corresponding source theo GPLv3.
